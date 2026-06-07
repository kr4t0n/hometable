from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from hometable import schemas
from hometable.database import get_db
from hometable.models import Tag

router = APIRouter(tags=["tags"])


@router.get("/tags", response_model=list[schemas.TagOut])
def list_tags(db: Session = Depends(get_db)) -> list[Tag]:
    return list(db.scalars(select(Tag).order_by(Tag.name)).all())
