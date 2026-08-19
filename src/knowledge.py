"""Knowledge Engine — the self-learning core.

Flow: query → embed → Redis cache → pgvector cosine search.
On miss, the Agent calls an AI provider and `learn()` persists the answer so the
*next* similar question is served with zero provider tokens (70-80% cost reduction).
"""
from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core import get_redis, settings
from models import KnowledgeEntry
from providers import factory

log = logging.getLogger("knowledge")


@dataclass
class SearchResult:
    entry: KnowledgeEntry | None
    similarity: float
    neighbors: list[tuple[KnowledgeEntry, float]]
    from_cache: bool


class KnowledgeEngine:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _cache_key(client_id, text: str) -> str:
        digest = hashlib.sha256(text.strip().lower().encode()).hexdigest()[:16]
        return f"kb:{client_id}:{digest}"

    async def search(self, client_id, text: str, threshold: float | None = None) -> SearchResult:
        """Cosine similarity search with a Redis hot-cache in front of pgvector."""
        threshold = threshold if threshold is not None else settings.SIMILARITY_THRESHOLD
        rds = get_redis()
        key = self._cache_key(client_id, text)

        cached = await rds.get(key)
        if cached:
            payload = json.loads(cached)
            entry = (await self.db.get(KnowledgeEntry, payload["id"]))
            if entry and entry.active:
                return SearchResult(entry, payload["similarity"], [], from_cache=True)

        (vec,) = await factory.embed([text])
        distance = KnowledgeEntry.embedding.cosine_distance(vec)
        stmt = (select(KnowledgeEntry, distance.label("d"))
                .where(KnowledgeEntry.client_id == client_id, KnowledgeEntry.active.is_(True))
                .order_by(distance).limit(5))
        rows = (await self.db.execute(stmt)).all()

        neighbors = [(row[0], round(1 - float(row[1]), 4)) for row in rows]
        best, best_sim = (neighbors[0] if neighbors else (None, 0.0))

        if best is not None and best_sim >= threshold:
            await rds.set(key, json.dumps({"id": str(best.id), "similarity": best_sim}),
                          ex=settings.KNOWLEDGE_CACHE_TTL)
            await self.db.execute(update(KnowledgeEntry)
                                  .where(KnowledgeEntry.id == best.id)
                                  .values(hit_count=KnowledgeEntry.hit_count + 1))
            await self.db.commit()
            log.info("knowledge HIT client=%s sim=%.3f", client_id, best_sim)
            return SearchResult(best, best_sim, neighbors, from_cache=False)

        log.info("knowledge MISS client=%s best_sim=%.3f", client_id, best_sim)
        return SearchResult(None, best_sim, neighbors, from_cache=False)

    async def learn(self, client_id, trigger: str, response: str, tool_calls: list[dict],
                    learned: bool = True) -> KnowledgeEntry:
        """Persist a freshly generated answer so it is reused next time (Knowledge Saver)."""
        (vec,) = await factory.embed([trigger])
        entry = KnowledgeEntry(
            client_id=client_id,
            category="learned" if learned else "curated",
            trigger_text=trigger.strip()[:4000],
            response_text=response.strip(),
            tool_calls=tool_calls,
            embedding=vec,
            learned=learned,
        )
        self.db.add(entry)
        await self.db.commit()
        await self.db.refresh(entry)

        # warm the cache immediately
        key = self._cache_key(client_id, trigger)
        await get_redis().set(key, json.dumps({"id": str(entry.id), "similarity": 1.0}),
                              ex=settings.KNOWLEDGE_CACHE_TTL)
        log.info("knowledge LEARNED id=%s client=%s", entry.id, client_id)
        return entry

    async def reindex(self, client_id) -> int:
        """Re-embed every entry for a client (after an embedding model swap)."""
        rows = (await self.db.execute(
            select(KnowledgeEntry).where(KnowledgeEntry.client_id == client_id))).scalars().all()
        for chunk_start in range(0, len(rows), 64):
            chunk = rows[chunk_start:chunk_start + 64]
            vecs = await factory.embed([e.trigger_text for e in chunk])
            for e, v in zip(chunk, vecs):
                e.embedding = v
        await self.db.commit()
        return len(rows)
