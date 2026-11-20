import { terminal, type Task } from "./types";
export type JobFilter = "all" | "attention" | "active" | "completed";
export function jobSummary(tasks: Task[]) {
  return {
    attention: tasks.filter((task) => task.status === "pending_accept" || task.acknowledged_brief_version < task.brief_version && !terminal(task.status)).length,
    active: tasks.filter((task) => ["accepted", "in_progress", "awaiting_verification"].includes(task.status)).length,
    completed: tasks.filter((task) => task.status === "completed").length,
  };
}
export function visibleJobs(tasks: Task[], filter: JobFilter, search: string) {
  const query = search.trim().toLocaleLowerCase();
  return tasks.filter((task) => {
    if (filter === "attention" && !(task.status === "pending_accept" || task.acknowledged_brief_version < task.brief_version && !terminal(task.status))) return false;
    if (filter === "active" && !["accepted", "in_progress", "awaiting_verification"].includes(task.status)) return false;
    if (filter === "completed" && task.status !== "completed") return false;
    const brief = task.briefing || {};
    return !query || [task.job_reference, task.company_name, task.kind, brief.origin, brief.destination, task.driver?.name, task.driver?.vehicle]
      .some((value) => String(value || "").toLocaleLowerCase().includes(query));
  });
}
