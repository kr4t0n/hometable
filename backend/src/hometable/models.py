from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


recipe_tags = Table(
    "recipe_tags",
    Base.metadata,
    Column("recipe_id", ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    servings: Mapped[int | None] = mapped_column(default=None)
    prep_time_min: Mapped[int | None] = mapped_column(default=None)
    cook_time_min: Mapped[int | None] = mapped_column(default=None)
    # App-managed reference to the chosen cover media row. Intentionally NOT a DB
    # foreign key, to avoid a recipes<->media cycle; integrity is enforced in the API.
    cover_media_id: Mapped[int | None] = mapped_column(default=None)
    # Reserved for future multi-user / auth; nullable so single-user works today.
    user_id: Mapped[int | None] = mapped_column(default=None, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    ingredients: Mapped[list[Ingredient]] = relationship(
        back_populates="recipe",
        cascade="all, delete-orphan",
        order_by="Ingredient.position",
    )
    steps: Mapped[list[Step]] = relationship(
        back_populates="recipe",
        cascade="all, delete-orphan",
        order_by="Step.position",
    )
    media: Mapped[list[Media]] = relationship(
        back_populates="recipe",
        cascade="all, delete-orphan",
        order_by="Media.position",
        foreign_keys="Media.recipe_id",
    )
    tags: Mapped[list[Tag]] = relationship(secondary=recipe_tags, back_populates="recipes")


class Ingredient(Base):
    __tablename__ = "ingredients"

    id: Mapped[int] = mapped_column(primary_key=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(default=0)
    name: Mapped[str] = mapped_column(String(200))
    quantity: Mapped[str | None] = mapped_column(String(50), default=None)
    unit: Mapped[str | None] = mapped_column(String(50), default=None)

    recipe: Mapped[Recipe] = relationship(back_populates="ingredients")


class Step(Base):
    __tablename__ = "steps"

    id: Mapped[int] = mapped_column(primary_key=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(default=0)
    instruction: Mapped[str] = mapped_column(Text)

    recipe: Mapped[Recipe] = relationship(back_populates="steps")


class Media(Base):
    __tablename__ = "media"

    id: Mapped[int] = mapped_column(primary_key=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id", ondelete="CASCADE"), index=True)
    media_type: Mapped[str] = mapped_column(String(16))  # image | video
    source: Mapped[str] = mapped_column(String(16))  # upload | embed
    status: Mapped[str] = mapped_column(String(16), default="ready")  # pending | ready
    storage_key: Mapped[str | None] = mapped_column(String(512), default=None)
    url: Mapped[str | None] = mapped_column(String(1024), default=None)
    provider: Mapped[str | None] = mapped_column(String(32), default=None)  # youtube | vimeo
    thumbnail_key: Mapped[str | None] = mapped_column(String(512), default=None)
    position: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    recipe: Mapped[Recipe] = relationship(back_populates="media", foreign_keys=[recipe_id])


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("name", name="uq_tags_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(64))
    kind: Mapped[str] = mapped_column(String(16), default="tag")  # tag | category

    recipes: Mapped[list[Recipe]] = relationship(secondary=recipe_tags, back_populates="tags")
