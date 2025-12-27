import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Drawer, Input } from "@medusajs/ui";
import { projectsApi } from "../../services/api";

interface CreateProjectDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Drawer component for creating a new project
 * Can be used from sidebar or anywhere in the app
 */
export function CreateProjectDrawer({ open, onOpenChange }: CreateProjectDrawerProps) {
  const [projectName, setProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  const handleCreateProject = async () => {
    if (!projectName.trim() || isCreating) return;
    
    setIsCreating(true);
    try {
      const project = await projectsApi.create(projectName.trim());
      setProjectName("");
      onOpenChange(false);
      navigate(`/projects/${project.id}`);
    } catch (error) {
      console.error("Error creating project:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setProjectName("");
      onOpenChange(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Create New Project</Drawer.Title>
          <Drawer.Description>
            Enter a name for your new factory planning project.
          </Drawer.Description>
        </Drawer.Header>
        <Drawer.Body>
          <div className="flex flex-col gap-y-3">
            <Input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Project name"
              disabled={isCreating}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isCreating) {
                  handleCreateProject();
                }
              }}
              autoFocus
            />
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary" disabled={isCreating}>
              Cancel
            </Button>
          </Drawer.Close>
          <Button onClick={handleCreateProject} disabled={isCreating || !projectName.trim()}>
            {isCreating ? "Creating..." : "Create"}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
}


