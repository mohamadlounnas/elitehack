import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Heading, Text, Skeleton, Container } from "@medusajs/ui";
import { TwoColumnPage } from "../components/layout/pages";
import { ChatInterface } from "../components/ChatInterface";
import { StepProgress } from "../components/StepProgress";
import { StepDetails } from "../components/StepDetails";
import { projectsApi, chatApi, planningApi, assetsApi } from "../services/api";
import type { Project, ProjectMessage, Asset } from "../types";

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadProject();
      loadMessages();
      loadAssets();
    }
  }, [id]);

  useEffect(() => {
    if (project && project.current_step !== "chat" && project.current_step !== "completed") {
      const interval = setInterval(() => {
        loadProject();
        loadAssets();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [project?.current_step]);

  const loadProject = async () => {
    if (!id) return;
    try {
      const data = await projectsApi.get(id);
      setProject(data);
    } catch (error) {
      console.error("Error loading project:", error);
    }
  };

  const loadMessages = async () => {
    if (!id) return;
    try {
      const data = await chatApi.getMessages(id);
      setMessages(data);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const loadAssets = async () => {
    if (!id) return;
    try {
      const data = await assetsApi.getAssets(id);
      setAssets(data);
    } catch (error: any) {
      if (error.code !== "ECONNABORTED" && error.name !== "CanceledError") {
        console.error("Error loading assets:", error);
      }
    }
  };

  const handleSendMessage = async (content: string, files?: File[]) => {
    if (!id) return;
    setIsLoading(true);
    try {
      await chatApi.sendMessage(id, content, files);
      await loadMessages();
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartPlanning = async () => {
    if (!id) return;
    try {
      await planningApi.startPlanning(id);
      await loadProject();
    } catch (error) {
      console.error("Error starting planning:", error);
    }
  };

  const handleRetryStep = async () => {
    if (!id) return;
    try {
      await planningApi.retryStep(id);
      await loadProject();
    } catch (error) {
      console.error("Error retrying step:", error);
    }
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center py-16">
        <Skeleton className="w-full max-w-md h-64" />
      </div>
    );
  }

  const showPlanningView = project.current_step !== "chat";
  const isCompleted = project.current_step === "completed";

  if (showPlanningView) {
    return (
      <TwoColumnPage>
        <TwoColumnPage.Main>
          <div className="flex flex-col gap-y-3">
            <Heading level="h1">{project.name}</Heading>
            {project.description && <Text className="text-ui-fg-subtle">{project.description}</Text>}
            <StepDetails
              projectId={project.id}
              currentStep={project.current_step}
              planningData={project.planning_data}
              assets={assets}
            />
          </div>
        </TwoColumnPage.Main>
        <TwoColumnPage.Sidebar>
          <Container>
            <StepProgress currentStep={project.current_step} onRetry={!isCompleted ? handleRetryStep : undefined} />
          </Container>
        </TwoColumnPage.Sidebar>
      </TwoColumnPage>
    );
  }

  return (
    <div className="flex flex-col gap-y-3">
      <Heading level="h1">{project.name}</Heading>
      {project.description && <Text className="text-ui-fg-subtle">{project.description}</Text>}
      <Container className="p-0">
        <ChatInterface
          projectId={project.id}
          messages={messages}
          onSendMessage={handleSendMessage}
          onStartPlanning={handleStartPlanning}
          isLoading={isLoading}
        />
      </Container>
    </div>
  );
}
