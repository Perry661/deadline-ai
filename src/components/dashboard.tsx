"use client";

import { useMemo, useState, type ChangeEvent } from "react";

import type { StoredTask } from "../features/tasks/task";
import { useTasks } from "../features/tasks/use-tasks";
import {
  createExportFilename,
  parseTasksFromJsonExport,
  serializeTasksToJson,
  serializeTasksToMarkdown,
} from "../features/tasks/export";
import { EmptyState } from "./empty-state";
import { TaskCard } from "./task-card";

type DashboardProps = {
  tasks: StoredTask[];
  onDeleteTask: (taskId: string) => void;
  onImportTasks?: (tasks: StoredTask[]) => void;
};

function downloadTextFile(
  filename: string,
  content: string,
  type: string,
): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function Dashboard({
  tasks,
  onDeleteTask,
  onImportTasks,
}: DashboardProps) {
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [importMessage, setImportMessage] = useState<string | undefined>();
  const [importError, setImportError] = useState<string | undefined>();
  const selectedTasks = useMemo(
    () => tasks.filter((task) => selectedTaskIds.has(task.id)),
    [selectedTaskIds, tasks],
  );
  const selectedCount = selectedTasks.length;

  function toggleTaskSelection(taskId: string, selected: boolean): void {
    setSelectedTaskIds((currentSelection) => {
      const nextSelection = new Set(currentSelection);

      if (selected) {
        nextSelection.add(taskId);
      } else {
        nextSelection.delete(taskId);
      }

      return nextSelection;
    });
  }

  function clearSelection(): void {
    setSelectedTaskIds(new Set());
  }

  function deleteSelectedTasks(): void {
    selectedTasks.forEach((task) => onDeleteTask(task.id));
    clearSelection();
  }

  function exportSelectedTasksAsJson(): void {
    downloadTextFile(
      createExportFilename("json"),
      serializeTasksToJson(selectedTasks),
      "application/json",
    );
  }

  function exportSelectedTasksAsMarkdown(): void {
    downloadTextFile(
      createExportFilename("md"),
      serializeTasksToMarkdown(selectedTasks),
      "text/markdown",
    );
  }

  async function importTasksFromJson(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    try {
      const importedTasks = parseTasksFromJsonExport(await file.text());

      onImportTasks?.(importedTasks);
      clearSelection();
      setImportError(undefined);
      setImportMessage(
        `Imported ${importedTasks.length} ${
          importedTasks.length === 1 ? "task" : "tasks"
        } as ${
          importedTasks.length === 1
            ? "a new local copy"
            : "new local copies"
        }.`,
      );
    } catch {
      setImportMessage(undefined);
      setImportError("Import failed. Choose a Deadline AI JSON export.");
    }
  }

  const importPanel = (
    <>
      <div className="importPanel">
        <label className="button" htmlFor="task-import-json">
          Import JSON
        </label>
        <input
          accept="application/json,.json"
          className="visuallyHidden"
          id="task-import-json"
          onChange={(event) => void importTasksFromJson(event)}
          type="file"
        />
        {importMessage ? (
          <p className="importStatus">{importMessage}</p>
        ) : null}
        {importError ? <p className="importError">{importError}</p> : null}
      </div>
    </>
  );

  if (tasks.length === 0) {
    return (
      <div className="dashboardStack">
        <EmptyState />
        {importPanel}
      </div>
    );
  }

  return (
    <section aria-labelledby="dashboard-title">
      <div className="hero">
        <p className="eyebrow">Dashboard</p>
        <h1 id="dashboard-title">Your active plans</h1>
        <p className="intro">
          Track progress, watch deadline pressure, and keep each plan moving.
        </p>
      </div>

      {importPanel}

      {selectedCount > 0 ? (
        <div className="bulkActionBar" aria-live="polite">
          <p>
            {selectedCount} {selectedCount === 1 ? "task" : "tasks"} selected
          </p>
          <div className="bulkActionButtons">
            <button
              className="button"
              onClick={exportSelectedTasksAsJson}
              type="button"
            >
              Export JSON
            </button>
            <button
              className="button"
              onClick={exportSelectedTasksAsMarkdown}
              type="button"
            >
              Export Markdown
            </button>
            <button
              className="button"
              onClick={deleteSelectedTasks}
              type="button"
            >
              Delete selected
            </button>
            <button className="button" onClick={clearSelection} type="button">
              Clear selection
            </button>
          </div>
        </div>
      ) : null}

      <div className="cardGrid">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            isSelected={selectedTaskIds.has(task.id)}
            task={task}
            onDeleteTask={onDeleteTask}
            onSelectionChange={toggleTaskSelection}
          />
        ))}
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <section className="card" aria-label="Loading dashboard">
      <p className="eyebrow">Loading</p>
      <h1>Loading your plans…</h1>
      <p className="intro">Checking this browser for saved tasks.</p>
    </section>
  );
}

export function DashboardPage() {
  const { tasks, hydrated, deleteTask, importTasks } = useTasks();

  return hydrated ? (
    <Dashboard
      tasks={tasks}
      onDeleteTask={deleteTask}
      onImportTasks={importTasks}
    />
  ) : (
    <DashboardSkeleton />
  );
}
