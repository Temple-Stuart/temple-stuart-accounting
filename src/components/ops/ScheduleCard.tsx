'use client';

import { ScheduleBlock } from './types';

interface ScheduleCardProps {
  schedule: ScheduleBlock[];
  onAdd: () => void;
  onUpdate: (blockId: string, updates: Partial<ScheduleBlock>) => void;
  onRemove: (blockId: string) => void;
}

export default function ScheduleCard({ schedule, onAdd, onUpdate, onRemove }: ScheduleCardProps) {
  return (
    <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-terminal-lg font-semibold text-text-primary">Schedule</span>
      </div>

      <div>
        {schedule.length === 0 && (
          <p className="px-3 py-4 text-center text-terminal-base text-text-faint font-mono">
            No schedule yet
          </p>
        )}

        {schedule.map((block) => (
          <div
            key={block.id}
            className={`flex items-center gap-2 px-3 py-1.5 group hover:bg-bg-row/50 transition-colors ${
              block.completed ? 'opacity-50' : ''
            }`}
          >
            <input
              type="text"
              value={block.time}
              onChange={(e) => onUpdate(block.id, { time: e.target.value })}
              placeholder="00:00"
              className="w-16 bg-transparent border-none outline-none text-terminal-sm font-mono text-text-muted px-1 py-0.5 hover:bg-gray-50 focus:bg-gray-50 rounded transition-colors placeholder:text-text-faint flex-shrink-0"
            />
            <input
              type="text"
              value={block.activity}
              onChange={(e) => onUpdate(block.id, { activity: e.target.value })}
              placeholder="What's happening?"
              className={`flex-1 bg-transparent border-none outline-none text-terminal-base font-mono px-1 py-0.5 hover:bg-gray-50 focus:bg-gray-50 rounded transition-colors placeholder:text-text-faint ${
                block.completed ? 'line-through text-text-faint' : 'text-text-primary'
              }`}
            />
            <input
              type="checkbox"
              checked={block.completed}
              onChange={() => onUpdate(block.id, { completed: !block.completed })}
              className="w-3.5 h-3.5 rounded border-border accent-brand-purple flex-shrink-0"
            />
            <button
              onClick={() => onRemove(block.id)}
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
        + Add Block
      </button>
    </div>
  );
}
