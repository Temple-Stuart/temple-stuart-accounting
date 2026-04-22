'use client';

import { Task } from './types';

const PRIORITY_COLORS: Record<Task['priority'], string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
};

const PRIORITY_CYCLE: Record<Task['priority'], Task['priority']> = {
  high: 'medium',
  medium: 'low',
  low: 'high',
};

interface TasksCardProps {
  tasks: Task[];
  onAdd: () => void;
  onUpdate: (taskId: string, updates: Partial<Task>) => void;
  onRemove: (taskId: string) => void;
}

export default function TasksCard({ tasks, onAdd, onUpdate, onRemove }: TasksCardProps) {
  const completed = tasks.filter((t) => t.completed).length;

  return (
    <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-terminal-lg font-semibold text-text-primary">Tasks</span>
        <span className="text-terminal-sm text-text-muted font-mono">
          {completed} / {tasks.length}
        </span>
      </div>

      <div>
        {tasks.length === 0 && (
          <p className="px-3 py-4 text-center text-terminal-base text-text-faint font-mono">
            No tasks yet
          </p>
        )}

        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-2 px-3 py-1.5 group hover:bg-bg-row/50 transition-colors"
          >
            <button
              onClick={() => onUpdate(task.id, { priority: PRIORITY_CYCLE[task.priority] })}
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 cursor-pointer ${PRIORITY_COLORS[task.priority]}`}
              title={task.priority}
            />
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => onUpdate(task.id, { completed: !task.completed })}
              className="w-3.5 h-3.5 rounded border-border accent-brand-purple flex-shrink-0"
            />
            <input
              type="text"
              value={task.text}
              onChange={(e) => onUpdate(task.id, { text: e.target.value })}
              placeholder="New task..."
              className={`flex-1 bg-transparent border-none outline-none text-terminal-base font-mono px-1 py-0.5 hover:bg-gray-50 focus:bg-gray-50 rounded transition-colors placeholder:text-text-faint ${
                task.completed ? 'line-through text-text-faint' : 'text-text-primary'
              }`}
            />
            <button
              onClick={() => onRemove(task.id)}
              className="text-text-faint hover:text-brand-red text-terminal-base opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 px-1"
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={onAdd}
        className="w-full px-3 py-2 text-terminal-sm text-text-muted hover:text-text-secondary font-mono text-left transition-colors"
      >
        + Add Task
      </button>
    </div>
  );
}
