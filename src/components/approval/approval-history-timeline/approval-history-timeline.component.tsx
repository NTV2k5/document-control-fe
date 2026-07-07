import { useState } from 'react';
import type { IApprovalHistoryTimelineProps } from './approval-history-timeline.type';

/**
 * ApprovalHistoryTimeline Component
 *
 * Displays a visual timeline of status changes and audit actions.
 * Shows:
 * - Creation and edits
 * - Submission
 * - Rejection reasons
 * - Final approval
 *
 * Features:
 * - Chronological ordering
 * - Clear icons for each action type
 * - Approver names and decisions
 * - Timestamps
 * - Expandable details
 */
export const ApprovalHistoryTimeline = ({ logs = [], isLoading = false }: IApprovalHistoryTimelineProps) => {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const time = date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const dateStr = date.toLocaleDateString('vi-VN', {
      month: 'short',
      day: 'numeric',
    });
    return `${dateStr} ${time}`;
  };

  const normalizeKey = (value: string) => value.trim().toUpperCase().replace(/\s+/g, '_');

  const getActionLabel = (action: string): string => {
    const labels: Record<string, string> = {
      CREATE: 'Đã tạo',
      CREATED: 'Đã tạo',
      UPDATE: 'Đã cập nhật',
      UPDATED: 'Đã cập nhật',
      SUBMIT: 'Đã gửi duyệt',
      SUBMITTED: 'Đã gửi duyệt',
      APPROVE: 'Đã phê duyệt',
      APPROVED: 'Đã phê duyệt',
      REJECT: 'Đã từ chối',
      REJECTED: 'Đã từ chối',
      PUBLISH: 'Đã ban hành',
      PUBLISHED: 'Đã ban hành',
      UNPUBLISH: 'Đã gỡ ban hành',
      UNPUBLISHED: 'Đã gỡ ban hành',
    };
    return labels[normalizeKey(action)] ?? action;
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      DRAFT: 'Bản nháp',
      SUBMITTED: 'Đã gửi duyệt',
      APPROVAL: 'Đang duyệt',
      IN_REVIEW: 'Đang duyệt',
      APPROVED: 'Đã duyệt',
      REJECTED: 'Bị từ chối',
      CANCELLED: 'Đã huỷ',
      PUBLISHED: 'Đã ban hành',
      UNPUBLISHED: 'Chưa ban hành',
    };
    return labels[normalizeKey(status)] ?? status;
  };

  const getActionIcon = (action: string): string => {
    const icons: Record<string, string> = {
      CREATE: '📝',
      CREATED: '📝',
      UPDATE: '✏️',
      UPDATED: '✏️',
      SUBMIT: '📤',
      SUBMITTED: '📤',
      APPROVE: '✅',
      APPROVED: '✅',
      REJECT: '❌',
      REJECTED: '❌',
      PUBLISH: '✅',
      PUBLISHED: '✅',
      UNPUBLISH: '↩',
      UNPUBLISHED: '↩',
    };
    return icons[normalizeKey(action)] || '•';
  };

  const getActionColor = (action: string): { bg: string; border: string; text: string } => {
    const colors: Record<string, { bg: string; border: string; text: string }> = {
      CREATE: { bg: '#f3f4f6', border: '#d1d5db', text: '#4b5563' },
      CREATED: { bg: '#f3f4f6', border: '#d1d5db', text: '#4b5563' },
      UPDATE: { bg: '#fef3c7', border: '#fcd34d', text: '#92400e' },
      UPDATED: { bg: '#fef3c7', border: '#fcd34d', text: '#92400e' },
      SUBMIT: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
      SUBMITTED: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
      APPROVE: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
      APPROVED: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
      REJECT: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
      REJECTED: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
      PUBLISH: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
      PUBLISHED: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
      UNPUBLISH: { bg: '#f3f4f6', border: '#d1d5db', text: '#4b5563' },
      UNPUBLISHED: { bg: '#f3f4f6', border: '#d1d5db', text: '#4b5563' },
    };
    return colors[normalizeKey(action)] || colors.UPDATED;
  };

  const timelineItems = logs
    .map((log) => ({
      id: log._id,
      type: 'log' as const,
      timestamp: log.timestamp,
      action: log.action,
      performed_by: log.performed_by,
      previous_status: log.previous_status,
      new_status: log.new_status,
      details: log.details,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (isLoading) {
    return (
      <div
        style={{
          padding: '12px',
          textAlign: 'center',
          color: '#6b7280',
          fontSize: '0.9em',
        }}>
        Đang tải lịch sử...
      </div>
    );
  }

  if (timelineItems.length === 0) {
    return (
      <div
        style={{
          padding: '12px',
          textAlign: 'center',
          color: '#9ca3af',
          fontSize: '0.9em',
        }}>
        Chưa có lịch sử
      </div>
    );
  }

  return (
    <div style={{ padding: '12px', backgroundColor: '#fafafa' }}>
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          margin: 0,
          padding: '0 0 8px 0',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          fontSize: '0.95em',
          fontWeight: 600,
          color: '#374151',
        }}>
        <span>📋 Dòng thời gian ({timelineItems.length})</span>
        <span
          style={{
            fontSize: '0.8em',
            color: '#9ca3af',
            transition: 'transform 0.2s',
            transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          }}>
          ▼
        </span>
      </button>

      {isCollapsed ? null : (
        <div style={{ position: 'relative' }}>
          {/* Vertical line */}
          <div
            style={{
              position: 'absolute',
              left: '12px',
              top: '24px',
              bottom: '0',
              width: '2px',
              backgroundColor: '#e5e7eb',
            }}
          />

          {/* Timeline items */}
          <div style={{ position: 'relative' }}>
            {timelineItems.map((item, _index) => {
              const colors = getActionColor(item.action);
              const isExpanded = expandedItemId === item.id;

              return (
                <div
                  key={item.id}
                  style={{
                    marginBottom: '12px',
                    paddingLeft: '32px',
                    position: 'relative',
                  }}>
                  {/* Timeline dot */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '4px',
                      top: '2px',
                      width: '18px',
                      height: '18px',
                      backgroundColor: 'white',
                      border: `2px solid ${colors.border}`,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8em',
                      zIndex: 1,
                    }}>
                    {getActionIcon(item.action)}
                  </div>

                  {/* Item content */}
                  <div
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      padding: '8px 10px',
                      cursor: item.details ? 'pointer' : 'default',
                      backgroundColor: colors.bg,
                    }}
                    onClick={() => item.details && setExpandedItemId(isExpanded ? null : item.id)}>
                    {/* Header row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '4px',
                      }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}>
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: '0.85em',
                            color: colors.text,
                          }}>
                          {getActionLabel(item.action)}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75em', color: '#6b7280' }}>{formatDate(item.timestamp)}</span>
                    </div>

                    {/* Performed by */}
                    <div style={{ fontSize: '0.8em', color: '#4b5563', marginBottom: '4px' }}>
                      <strong>{item.performed_by}</strong>
                    </div>

                    {/* Status change */}
                    {item.type === 'log' && item.previous_status && item.new_status && (
                      <div style={{ fontSize: '0.75em', color: '#6b7280' }}>
                        {getStatusLabel(item.previous_status)} → {getStatusLabel(item.new_status)}
                      </div>
                    )}

                    {/* Expandable details */}
                    {item.details && item.type === 'log' && (
                      <>
                        {isExpanded && (
                          <div
                            style={{
                              marginTop: '8px',
                              paddingTop: '8px',
                              borderTop: `1px solid ${colors.border}`,
                              fontSize: '0.75em',
                              color: '#6b7280',
                            }}>
                            <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                              {JSON.stringify(item.details, null, 2)}
                            </div>
                          </div>
                        )}
                        <div style={{ marginTop: '6px', fontSize: '0.75em' }}>{isExpanded ? '▼' : '▶'} Chi tiết</div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
