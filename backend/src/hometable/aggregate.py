"""Combine the ingredients of several recipes into one shopping list.

A *meal* is made of multiple recipes, so the same ingredient often shows up more
than once. This module groups identical ingredients (matched on name + unit,
case-insensitively) and sums their quantities. Quantities are stored as free
text (``"2"``, ``"1/2"``, ``"a pinch"``), so we sum the numeric ones exactly with
``Fraction`` and keep the non-numeric ones verbatim.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field
from fractions import Fraction

from hometable.schemas import AggregatedIngredient


def parse_quantity(raw: str | None) -> Fraction | None:
    """Parse a free-text quantity into an exact ``Fraction``, or ``None``.

    Understands integers (``"2"``), decimals (``"1.5"``), simple fractions
    (``"1/2"``) and mixed numbers (``"1 1/2"``). Anything else — ``"a pinch"``,
    ``"to taste"``, a range like ``"2-3"`` — is treated as non-numeric so the
    caller can keep it verbatim.
    """
    if raw is None:
        return None
    text = raw.strip()
    if not text:
        return None
    tokens = text.split()
    try:
        if len(tokens) == 1:
            return Fraction(tokens[0])
        if len(tokens) == 2:  # mixed number, e.g. "1 1/2"
            whole, frac = Fraction(tokens[0]), Fraction(tokens[1])
            if whole < 0 or frac < 0:
                return None
            return whole + frac
    except (ValueError, ZeroDivisionError):
        return None
    return None


def format_quantity(value: Fraction) -> str:
    """Render a ``Fraction`` back as a friendly string: ``"3"``, ``"3/4"``, ``"1 1/2"``."""
    if value.denominator == 1:
        return str(value.numerator)
    whole, remainder = divmod(value.numerator, value.denominator)
    if whole:
        return f"{whole} {remainder}/{value.denominator}"
    return f"{value.numerator}/{value.denominator}"


@dataclass
class _Group:
    name: str  # display name (first spelling seen)
    unit: str | None  # display unit (first spelling seen)
    total: Fraction = Fraction(0)
    has_numeric: bool = False
    text_parts: dict[str, int] = field(default_factory=dict)  # "a pinch" -> count
    recipe_ids: set[int] = field(default_factory=set)


def _quantity_display(group: _Group) -> str | None:
    parts: list[str] = []
    if group.has_numeric and group.total > 0:
        parts.append(format_quantity(group.total))
    for raw, count in group.text_parts.items():
        parts.append(f"{raw} ×{count}" if count > 1 else raw)
    return " + ".join(parts) if parts else None


def aggregate_ingredients(recipes: Iterable) -> list[AggregatedIngredient]:
    """Merge every recipe's ingredients into a single, alphabetised list.

    ``recipes`` is any iterable of objects exposing ``id`` and ``ingredients``
    (each ingredient exposing ``name``, ``quantity`` and ``unit``) — i.e. ORM
    ``Recipe`` rows, but plain stand-ins work too, which keeps this unit-testable.
    """
    groups: dict[tuple[str, str], _Group] = {}
    for recipe in recipes:
        for ing in recipe.ingredients:
            name = (ing.name or "").strip()
            if not name:
                continue
            unit = (ing.unit or "").strip() or None
            key = (name.lower(), (unit or "").lower())
            group = groups.get(key)
            if group is None:
                group = _Group(name=name, unit=unit)
                groups[key] = group
            group.recipe_ids.add(recipe.id)
            qty = parse_quantity(ing.quantity)
            if qty is not None:
                group.total += qty
                group.has_numeric = True
            elif raw := (ing.quantity or "").strip():
                group.text_parts[raw] = group.text_parts.get(raw, 0) + 1

    items = [
        AggregatedIngredient(
            name=g.name,
            unit=g.unit,
            quantity=_quantity_display(g),
            recipe_count=len(g.recipe_ids),
        )
        for g in groups.values()
    ]
    items.sort(key=lambda i: (i.name.lower(), i.unit or ""))
    return items
