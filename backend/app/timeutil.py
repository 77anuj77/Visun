from datetime import UTC, datetime


def parse_dt(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    else:
        parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def to_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def cents(amount: float) -> int:
    return round(amount * 100)


def dollars(amount_cents: int | None) -> float | None:
    if amount_cents is None:
        return None
    return round(amount_cents / 100, 2)
