# app/cache.py
"""
In-memory TTL caching layer.

Uses ``cachetools`` for lightweight, thread-safe caching with automatic
TTL expiration.  No external infrastructure (Redis, Memcached) required.

Cache is invalidated explicitly when new data is uploaded.
"""

from __future__ import annotations

import functools
import hashlib
import logging
from collections.abc import Callable
from typing import Any

from cachetools import TTLCache

logger = logging.getLogger(__name__)

# -- Cache instances -----------------------------------------------------------
# Max 256 entries, 5-minute TTL.  Tunable via env vars if needed later.
_indices_cache: TTLCache = TTLCache(maxsize=256, ttl=300)
_map_cache: TTLCache = TTLCache(maxsize=256, ttl=300)


def _make_key(*args: Any, **kwargs: Any) -> str:
    """Create a stable hash key from function arguments."""
    raw = f"{args}:{sorted(kwargs.items())}"
    return hashlib.md5(raw.encode()).hexdigest()


def cached_indices(func: Callable) -> Callable:
    """Decorator to cache indices endpoint results."""

    @functools.wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        key = _make_key(*args, **kwargs)
        if key in _indices_cache:
            logger.debug("Cache HIT for indices (key=%s)", key[:8])
            return _indices_cache[key]
        result = await func(*args, **kwargs)
        _indices_cache[key] = result
        logger.debug("Cache MISS for indices (key=%s)", key[:8])
        return result

    return wrapper


def cached_map(func: Callable) -> Callable:
    """Decorator to cache map endpoint results."""

    @functools.wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        key = _make_key(*args, **kwargs)
        if key in _map_cache:
            logger.debug("Cache HIT for map (key=%s)", key[:8])
            return _map_cache[key]
        result = await func(*args, **kwargs)
        _map_cache[key] = result
        logger.debug("Cache MISS for map (key=%s)", key[:8])
        return result

    return wrapper


def invalidate_all() -> None:
    """Clear all caches.  Called after new data uploads."""
    _indices_cache.clear()
    _map_cache.clear()
    logger.info("All caches invalidated.")
