import { displayText } from './display-text.js';

export function deletionRequestViewState(request) {
  const status = request ? displayText(request.status) : '';
  const requestedAt = request?.requested_at ? new Date(request.requested_at).toLocaleString() : '';
  return {
    hasPendingRequest: status === 'pending' && !!request,
    status,
    decisionReason: request ? displayText(request.decision_reason) : '',
    requestedAt,
  };
}
