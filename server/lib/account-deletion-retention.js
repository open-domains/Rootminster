export const APPROVED_ACCOUNT_DELETION_RETENTION_DAYS = 30;

export async function purgeApprovedAccountDeletionRequests(db, retentionDays = APPROVED_ACCOUNT_DELETION_RETENTION_DAYS) {
  const result = await db.query(
    `DELETE FROM account_deletion_requests
     WHERE status = 'approved'
       AND decided_at <= now() - ($1 || ' days')::interval`,
    [retentionDays],
  );
  return { deleted: result.rowCount || 0 };
}
