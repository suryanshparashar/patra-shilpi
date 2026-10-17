from agents.runtime import AgentRuntime
from agents.workers.analysis import make_jd_analyzer, make_resume_structurer
from agents.workers.base import NodeFn, worker_node
from agents.workers.customizing import make_guardrail, make_section_customizer
from agents.workers.evaluating import make_cover_letter, make_evaluator
from agents.workers.scoring import make_match_scorer


def build_worker_nodes(rt: AgentRuntime) -> dict[str, NodeFn]:
    """All worker nodes keyed by name (the names the supervisor routes to)."""
    return {
        "jd_analyzer": worker_node("jd_analyzer", make_jd_analyzer(rt)),
        "resume_structurer": worker_node("resume_structurer", make_resume_structurer(rt)),
        "match_scorer": worker_node("match_scorer", make_match_scorer(rt)),
        "section_customizer": worker_node("section_customizer", make_section_customizer(rt)),
        "guardrail": worker_node("guardrail", make_guardrail(rt)),
        "evaluator": worker_node("evaluator", make_evaluator(rt)),
        "cover_letter": worker_node("cover_letter", make_cover_letter(rt)),
    }
