from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from agents.routing import FINISH, WORKERS
from agents.runtime import AgentRuntime
from agents.state import GraphState
from agents.supervisor import make_supervisor
from agents.workers import build_worker_nodes


def _route(state: GraphState) -> str:
    return state["next_worker"]


def build_graph(rt: AgentRuntime) -> CompiledStateGraph:  # type: ignore[type-arg]
    """Supervisor + workers: every worker reports back to the supervisor, which picks the next."""
    graph = StateGraph(GraphState)
    graph.add_node("supervisor", make_supervisor(rt))  # type: ignore[call-overload]
    for name, node in build_worker_nodes(rt).items():
        graph.add_node(name, node)  # type: ignore[call-overload]
        graph.add_edge(name, "supervisor")

    graph.add_edge(START, "supervisor")
    graph.add_conditional_edges(
        "supervisor", _route, {**{name: name for name in WORKERS}, FINISH: END}
    )
    return graph.compile()
