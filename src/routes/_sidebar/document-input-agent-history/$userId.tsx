import { createFileRoute } from '@tanstack/react-router';
import { DocumentInputAgentHistoryPage } from '../../../pages';

const DocumentInputAgentHistoryDetailRouteComponent = () => {
  const { userId } = Route.useParams();
  return <DocumentInputAgentHistoryPage user_id={userId} />;
};

export const Route = createFileRoute('/_sidebar/document-input-agent-history/$userId')({
  component: DocumentInputAgentHistoryDetailRouteComponent,
});
