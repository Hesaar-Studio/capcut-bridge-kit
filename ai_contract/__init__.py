"""
AI Editing Contract Layer
=========================
Provider-neutral contract and execution routing layer for CapCut Bridge Kit.
Allows external AI systems (ChatGPT, Claude, Gravity, Gemini) to inspect, plan,
and interact safely with CapCut Desktop.
"""

from .capabilities import (
    CapabilityRegistry,
    CapabilityStatus,
    ToolCapability,
    build_capability_registry,
)
from .dispatcher import (
    ContractDispatcher,
    dispatch_contract_request,
)
from .receipt import (
    GLOBAL_RECEIPT_STORE,
    ExecutionReceipt,
    ExecutionStatus,
    ReceiptStore,
)
from .schemas import (
    TOOL_PARAM_SCHEMAS,
    ContractRequest,
    ContractResponse,
    validate_contract_request,
)

__all__ = [
    "CapabilityRegistry",
    "CapabilityStatus",
    "ToolCapability",
    "build_capability_registry",
    "ContractRequest",
    "ContractResponse",
    "validate_contract_request",
    "TOOL_PARAM_SCHEMAS",
    "ExecutionReceipt",
    "ExecutionStatus",
    "ReceiptStore",
    "GLOBAL_RECEIPT_STORE",
    "ContractDispatcher",
    "dispatch_contract_request",
]
