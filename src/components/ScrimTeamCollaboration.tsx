import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type TeamReview = {
  id: string;
  scrim_id: string;
  team_id: string;
  author_id: string;
  category: "mistake" | "positive";
  match_number: number | null;
  title: string;
  detail: string;
  solution: string;
  created_at?: string;
};
type TeamMember = {
  user_id: string;
  display_name?: string;
  assigned_role?: string | null;
  membership_role?: string;
};
type CommentRow = {
  id: string;
  review_id: string;
  author_id: string;
  body: string;
  created_at: string;
};
type TaskRow = {
  id: string;
  source_review_id: string | null;
  assigned_to: string | null;
  title: string;
  description: string;
  status: "open" | "in_progress" | "done" | "cancelled";
  due_date: string | null;
  created_at: string;
};

const dateLabel = (value: string) =>
  new Date(value + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default function ScrimTeamCollaboration({
  supabase,
  scrimId,
  teamId,
  userId,
  reviews,
  members,
  canManage,
}: {
  supabase: SupabaseClient | null;
  scrimId: string;
  teamId: string;
  userId: string;
  reviews: TeamReview[];
  members: TeamMember[];
  canManage: boolean;
}) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskSource, setTaskSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    if (!supabase || !scrimId || !teamId) {
      setComments([]);
      setTasks([]);
      return () => { active = false; };
    }
    (async () => {
      const [commentResult, taskResult] = await Promise.all([
        supabase.from("scrim_team_review_comments").select("*").eq("scrim_id", scrimId).order("created_at", { ascending: true }),
        supabase.from("scrim_review_tasks").select("*").eq("scrim_id", scrimId).order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      if (commentResult.error) setNotice(commentResult.error.message);
      else setComments((commentResult.data || []) as CommentRow[]);
      if (taskResult.error) setNotice(taskResult.error.message);
      else setTasks((taskResult.data || []) as TaskRow[]);
    })();
    return () => { active = false; };
  }, [supabase, scrimId, teamId]);

  const commentsByReview = useMemo(() => {
    const grouped: Record<string, CommentRow[]> = {};
    for (const item of comments) {
      grouped[item.review_id] = [...(grouped[item.review_id] || []), item];
    }
    return grouped;
  }, [comments]);

  const addComment = async (review: TeamReview) => {
    const body = (drafts[review.id] || "").trim();
    if (!supabase || !body || !userId || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("scrim_team_review_comments")
        .insert({
          scrim_id: scrimId,
          review_id: review.id,
          team_id: teamId,
          author_id: userId,
          body,
        })
        .select("*")
        .single();
      if (error) throw error;
      setComments((previous) => [...previous, data as CommentRow]);
      setDrafts((previous) => ({ ...previous, [review.id]: "" }));
      setNotice("Comment added to team review.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Comment could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const addTask = async () => {
    if (!supabase || !canManage || !taskTitle.trim() || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("scrim_review_tasks")
        .insert({
          scrim_id: scrimId,
          source_review_id: taskSource || null,
          team_id: teamId,
          created_by: userId,
          assigned_to: taskAssignee || null,
          title: taskTitle.trim(),
          description: taskDescription.trim(),
          due_date: taskDueDate || null,
          status: "open",
        })
        .select("*")
        .single();
      if (error) throw error;
      setTasks((previous) => [data as TaskRow, ...previous]);
      setTaskTitle("");
      setTaskDescription("");
      setTaskAssignee("");
      setTaskDueDate("");
      setTaskSource("");
      setNotice("Team action item created.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Action item could not be created.");
    } finally {
      setBusy(false);
    }
  };

  const updateTaskStatus = async (task: TaskRow, status: TaskRow["status"]) => {
    if (!supabase || busy || !(canManage || task.assigned_to === userId)) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("scrim_review_tasks")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", task.id)
        .select("*")
        .single();
      if (error) throw error;
      setTasks((previous) => previous.map((item) => item.id === task.id ? data as TaskRow : item));
      setNotice("Action item status updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Action item update failed.");
    } finally {
      setBusy(false);
    }
  };

  const deleteTask = async (task: TaskRow) => {
    if (!supabase || !canManage || busy) return;
    if (!window.confirm("Delete this team action item?")) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("scrim_review_tasks").delete().eq("id", task.id);
      if (error) throw error;
      setTasks((previous) => previous.filter((item) => item.id !== task.id));
      setNotice("Action item deleted.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Action item could not be deleted.");
    } finally {
      setBusy(false);
    }
  };

  const memberName = (id: string | null) => {
    if (!id) return "Unassigned";
    return members.find((member) => member.user_id === id)?.display_name || "Team member";
  };

  return (
    <div className="scrims-collaboration">
      {notice && <p className="scrims-collab-notice" role="status">{notice}</p>}
      <section className="scrims-collab-section">
        <div className="scrims-block-head">
          <div><h3>Team discussion</h3><p>Reply to each shared observation; comments remain visible to active teammates.</p></div>
          <span>{comments.length} comments</span>
        </div>
        {reviews.length === 0 ? (
          <p className="scrims-empty">Add a team observation above to start a discussion.</p>
        ) : reviews.map((review) => (
          <article className="scrims-discussion-card" key={review.id}>
            <div className="scrims-discussion-title">
              <strong>{review.title}</strong>
              <span>{review.category === "positive" ? "Positive play" : "Team mistake"}</span>
            </div>
            <div className="scrims-comment-list">
              {(commentsByReview[review.id] || []).map((comment) => (
                <div className="scrims-comment" key={comment.id}>
                  <p>{comment.body}</p>
                  <small>{memberName(comment.author_id)} · {dateLabel(comment.created_at)}</small>
                </div>
              ))}
            </div>
            <div className="scrims-comment-entry">
              <input
                value={drafts[review.id] || ""}
                maxLength={2000}
                placeholder="Add a constructive comment…"
                onChange={(event) => setDrafts((previous) => ({ ...previous, [review.id]: event.target.value }))}
              />
              <button className="scrims-secondary" disabled={busy || !(drafts[review.id] || "").trim()} onClick={() => addComment(review)}>Reply</button>
            </div>
          </article>
        ))}
      </section>

      <section className="scrims-collab-section">
        <div className="scrims-block-head">
          <div><h3>Team action items</h3><p>Turn a review observation into an assigned practice follow-up.</p></div>
          <span>{tasks.filter((task) => task.status !== "done" && task.status !== "cancelled").length} open</span>
        </div>
        {canManage && (
          <div className="scrims-task-form">
            <label>Action item<input value={taskTitle} maxLength={120} onChange={(event) => setTaskTitle(event.target.value)} placeholder="e.g. Drill early zone rotation"/></label>
            <label>Details<textarea value={taskDescription} maxLength={2000} onChange={(event) => setTaskDescription(event.target.value)} placeholder="What should the player or squad practice?"/></label>
            <div className="scrims-task-grid">
              <label>Assign to<select value={taskAssignee} onChange={(event) => setTaskAssignee(event.target.value)}>
                <option value="">Unassigned</option>
                {members.map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name || "Team member"}</option>)}
              </select></label>
              <label>Due date<input type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)}/></label>
              <label>Related review<select value={taskSource} onChange={(event) => setTaskSource(event.target.value)}>
                <option value="">General Scrim follow-up</option>
                {reviews.map((review) => <option key={review.id} value={review.id}>{review.title}</option>)}
              </select></label>
            </div>
            <button className="scrims-secondary" disabled={busy || !taskTitle.trim()} onClick={addTask}>＋ Create action item</button>
          </div>
        )}
        <div className="scrims-task-list">
          {tasks.length === 0 ? <p className="scrims-empty">No action items have been created for this Scrim.</p> : tasks.map((task) => (
            <article className="scrims-task-card" key={task.id}>
              <div className="scrims-task-main">
                <strong>{task.title}</strong>
                <p>{task.description || "No extra details."}</p>
                <small>{memberName(task.assigned_to)}{task.due_date ? " · Due " + dateLabel(task.due_date) : ""}</small>
              </div>
              <div className="scrims-task-controls">
                <select
                  aria-label={"Status for " + task.title}
                  value={task.status}
                  disabled={busy || !(canManage || task.assigned_to === userId)}
                  onChange={(event) => updateTaskStatus(task, event.target.value as TaskRow["status"])}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                {canManage && <button className="scrims-task-delete" disabled={busy} onClick={() => deleteTask(task)}>Delete</button>}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
