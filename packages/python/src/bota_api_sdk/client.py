"""Maintained public client; generated contracts share one HTTP policy runtime."""
from __future__ import annotations

from typing import cast

from .generated.client import BotaApiClient as GeneratedReadClient
from .generated.mutations import models
from .runtime import UNSET, MutationRequestOptions, ReadResult, UnsetType


class BotaApiClient(GeneratedReadClient):
    """Eleven reads and two single-attempt ordinary end-user mutations."""

    async def post_end_users(self, input: models.PostEndUsersInput,
                             options: MutationRequestOptions | UnsetType = UNSET) -> ReadResult[models.PostEndUsersResponse]:
        return cast("ReadResult[models.PostEndUsersResponse]", cast(object, await self.mutate("postEndUsers", input, options)))

    async def patch_end_users_by_id(self, input: models.PatchEndUsersByIdInput,
                                    options: MutationRequestOptions | UnsetType = UNSET) -> ReadResult[models.PatchEndUsersByIdResponse]:
        return cast("ReadResult[models.PatchEndUsersByIdResponse]", cast(object, await self.mutate("patchEndUsersById", input, options)))
