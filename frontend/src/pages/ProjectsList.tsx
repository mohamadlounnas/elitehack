import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Heading, Text, Prompt, Input, Container } from "@medusajs/ui";
import { Plus } from "@medusajs/icons";
import { SingleColumnPage } from "../components/layout/pages";
import { projectsApi } from "../services/api";
import type { Project } from "../types";

export function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreatePrompt, setShowCreatePrompt] = useState(false);
  const [projectName, setProjectName] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await projectsApi.getAll();
      setProjects(data);
    } catch (error) {
      console.error("Error loading projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) return;
    try {
      const project = await projectsApi.create(projectName.trim());
      setShowCreatePrompt(false);
      setProjectName("");
      navigate(`/projects/${project.id}`);
    } catch (error) {
      console.error("Error creating project:", error);
    }
  };

  if (isLoading) {
    return (
      <SingleColumnPage>
        <div className="flex items-center justify-center py-16">
          <Text className="text-ui-fg-subtle">Loading...</Text>
        </div>
      </SingleColumnPage>
    );
  }

  return (
    <SingleColumnPage>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h1">Factory Planning Projects</Heading>
          <Button size="small" variant="secondary" onClick={() => setShowCreatePrompt(true)}>
            <Plus />
            Create Project
          </Button>
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <Text className="text-ui-fg-subtle mb-4">No projects yet. Create your first project to get started.</Text>
            <Button onClick={() => setShowCreatePrompt(true)} variant="secondary">
              <Plus />
              Create Project
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-ui-bg-subtle-hover cursor-pointer transition-colors"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <div className="flex flex-col gap-y-1 flex-1 min-w-0">
                  <Heading level="h2" className="truncate">{project.name}</Heading>
                  {project.description && (
                    <Text className="text-ui-fg-subtle text-sm line-clamp-1">{project.description}</Text>
                  )}
                  <div className="flex items-center gap-x-2 mt-1">
                    <Text size="small" className="text-ui-fg-subtle capitalize">
                      {project.current_step.replace(/([A-Z])/g, " $1").trim()}
                    </Text>
                    <Text size="small" className="text-ui-fg-muted">
                      • {new Date(project.created_at).toLocaleDateString()}
                    </Text>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Container>

      <Prompt open={showCreatePrompt} onOpenChange={setShowCreatePrompt}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Create New Project</Prompt.Title>
            <Prompt.Description>Enter a name for your new factory planning project.</Prompt.Description>
          </Prompt.Header>
          <Prompt.Body>
            <Input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Project name"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateProject();
              }}
            />
          </Prompt.Body>
          <Prompt.Footer>
            <Prompt.Cancel>Cancel</Prompt.Cancel>
            <Prompt.Action onClick={handleCreateProject}>Create</Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </SingleColumnPage>
  );
}
