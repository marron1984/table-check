import type { CustomerTag } from "../api";

export function TagBadge({ tag }: { tag: CustomerTag }) {
  return (
    <span
      className="tag"
      style={{
        backgroundColor: `${tag.tagDefinition.color}15`,
        color: tag.tagDefinition.color || "#6B7280",
        border: `1px solid ${tag.tagDefinition.color}40`,
      }}
    >
      {tag.tagDefinition.labelJa}
    </span>
  );
}
