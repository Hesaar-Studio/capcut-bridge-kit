"""
Execution Receipt
=================
Canonical JSON-serializable ExecutionReceipt representing operation lifecycle states.
Never reports success without actual verification.
"""

from __future__ import annotations

import datetime
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class ExecutionStatus(str, Enum):
    PLANNED = "PLANNED"
    AWAITING_CONFIRMATION = "AWAITING_CONFIRMATION"
    EXECUTING = "EXECUTING"
    VERIFIED = "VERIFIED"
    FAILED = "FAILED"
    ROLLED_BACK = "ROLLED_BACK"


@dataclass
class ExecutionReceipt:
    """Canonical receipt documenting a proposed, ongoing, or completed operation."""
    execution_id: str
    project_name: str
    requested_operation: str
    status: ExecutionStatus
    applied: bool = False
    actions_count: int = 0
    backup_path: Optional[str] = None
    validation_passed: bool = False
    readback_verified: bool = False
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    timestamp: str = field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
    )
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "execution_id": self.execution_id,
            "project_name": self.project_name,
            "requested_operation": self.requested_operation,
            "status": self.status.value,
            "applied": self.applied,
            "actions_count": self.actions_count,
            "backup_path": self.backup_path,
            "validation_passed": self.validation_passed,
            "readback_verified": self.readback_verified,
            "warnings": list(self.warnings),
            "errors": list(self.errors),
            "timestamp": self.timestamp,
            "metadata": dict(self.metadata),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> ExecutionReceipt:
        return cls(
            execution_id=str(data.get("execution_id", "")),
            project_name=str(data.get("project_name", "")),
            requested_operation=str(data.get("requested_operation", "")),
            status=ExecutionStatus(data.get("status", ExecutionStatus.FAILED.value)),
            applied=bool(data.get("applied", False)),
            actions_count=int(data.get("actions_count", 0)),
            backup_path=data.get("backup_path"),
            validation_passed=bool(data.get("validation_passed", False)),
            readback_verified=bool(data.get("readback_verified", False)),
            warnings=list(data.get("warnings", [])),
            errors=list(data.get("errors", [])),
            timestamp=str(data.get("timestamp", "")),
            metadata=dict(data.get("metadata", {})),
        )


class ReceiptStore:
    """Thread-safe in-memory store for execution receipts."""
    def __init__(self):
        self._receipts: Dict[str, ExecutionReceipt] = {}

    def store(self, receipt: ExecutionReceipt) -> None:
        self._receipts[receipt.execution_id] = receipt

    def get(self, execution_id: str) -> Optional[ExecutionReceipt]:
        return self._receipts.get(execution_id)

    def list_all(self) -> List[ExecutionReceipt]:
        return list(self._receipts.values())

    def clear(self) -> None:
        self._receipts.clear()


# Global default store instance
GLOBAL_RECEIPT_STORE = ReceiptStore()
