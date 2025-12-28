import { useState, useEffect } from "react";
import { useParams, useLoaderData } from "react-router-dom";
import { Heading, Text, Skeleton, Container } from "@medusajs/ui";
import { TwoColumnPage } from "../components/layout/pages";
import { ChatInterface } from "../components/ChatInterface";
import { StepProgress } from "../components/StepProgress";
import { StepDetails } from "../components/StepDetails";
import { CompletedDashboard } from "../components/completed/CompletedDashboard";
import { projectsApi, chatApi, planningApi, assetsApi, dataApi } from "../services/api";
import type { Project, ProjectMessage, Asset, Supplier, GeneratedFile, TCOCalculation } from "../types";

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [tco, setTco] = useState<TCOCalculation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStepProcessing, setIsStepProcessing] = useState(false); // Track if step is actively streaming
  const [hasStepError, setHasStepError] = useState(false); // Track if step has an error

  useEffect(() => {
    if (id) {
      loadProject();
      loadMessages();
      loadAssets();
      loadProjectData();
    }
  }, [id]);

  useEffect(() => {
    if (project && project.current_step !== "chat" && project.current_step !== "completed") {
      const interval = setInterval(() => {
        loadProject();
        loadAssets();
        loadProjectData();
      }, 5000);
      return () => clearInterval(interval);
    } else if (project && project.current_step === "completed") {
      // Load all data once when completed
      loadProjectData();
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

  const loadProjectData = async () => {
    if (!id) return;
    try {
      const [suppliersData, filesData, tcoData] = await Promise.all([
        dataApi.getSuppliers(id).catch(() => []),
        dataApi.getGeneratedFiles(id).catch(() => []),
        dataApi.getTCO(id).catch(() => null),
      ]);
      setSuppliers(suppliersData || []);
      setGeneratedFiles(filesData || []);
      setTco(tcoData);
    } catch (error) {
      console.error("Error loading project data:", error);
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

  const handleGenerateReports = async () => {
    if (!id) return;
    try {
      await dataApi.generateReports(id);
      // Reload project to get updated PDF/Excel paths
      await loadProject();
      await loadProjectData();
    } catch (error) {
      console.error("Error generating reports:", error);
      throw error; // Re-throw so the component can handle it
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

  const handleNextStep = async () => {
    if (!id) return;
    try {
      await planningApi.nextStep(id);
      await loadProject();
    } catch (error) {
      console.error("Error moving to next step:", error);
    }
  };

  const handlePrevStep = async () => {
    if (!id) return;
    try {
      await planningApi.prevStep(id);
      await loadProject();
    } catch (error) {
      console.error("Error moving to previous step:", error);
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

  // Completed Dashboard - Full width, no sidebar
  if (isCompleted) {
    return (
      <div className="flex flex-col gap-y-4">
        <CompletedDashboard
          project={project}
          planningData={project.planning_data}
          assets={assets}
          suppliers={suppliers}
          generatedFiles={generatedFiles}
          tco={tco}
          messages={messages}
          onGenerateReports={handleGenerateReports}
        />
      </div>
    );
  }

  // In-progress steps - Two column layout with sidebar
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
              suppliers={suppliers}
              generatedFiles={generatedFiles}
              tco={tco}
              messages={messages}
              project={project}
              onStreamingStatusChange={setIsStepProcessing}
              onErrorStatusChange={setHasStepError}
            />
          </div>
        </TwoColumnPage.Main>
        <TwoColumnPage.Sidebar>
          <StepProgress 
            currentStep={project.current_step} 
            isStepProcessing={isStepProcessing}
            hasError={hasStepError}
            onRetry={handleRetryStep}
            onNextStep={handleNextStep}
            onPrevStep={handlePrevStep}
          />
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
