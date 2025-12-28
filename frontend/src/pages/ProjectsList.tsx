import { useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Heading, Text, Container, StatusBadge, Skeleton } from "@medusajs/ui";
import { 
  CheckCircleSolid, 
  CircleHalfSolid, 
  CircleDottedLine,
  Calendar,
  ArrowRight
} from "@medusajs/icons";
import { SingleColumnPage } from "../components/layout/pages";
import { projectsApi } from "../services/api";
import type { Project, ProjectStep } from "../types";

export function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await projectsApi.getAll();
      // Sort by most recently updated
      const sorted = data.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      setProjects(sorted);
    } catch (error) {
      console.error("Error loading projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SingleColumnPage>
        <div className="flex flex-col gap-y-3">
          <Heading level="h1">Projects</Heading>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Container key={i} className="p-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-3" />
                <Skeleton className="h-4 w-1/2" />
              </Container>
            ))}
          </div>
        </div>
      </SingleColumnPage>
    );
  }

  return (
    <SingleColumnPage>
      <div className="flex flex-col gap-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h1">Projects</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              {projects.length} {projects.length === 1 ? "project" : "projects"}
            </Text>
          </div>
        </div>

        {projects.length === 0 ? (
          <Container className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 bg-ui-bg-subtle rounded-full flex items-center justify-center mb-4">
              <CircleDottedLine className="w-8 h-8 text-ui-fg-muted" />
            </div>
            <Heading level="h2" className="mb-2">No projects yet</Heading>
            <Text className="text-ui-fg-subtle text-center mb-6 max-w-md">
              Create your first factory planning project to get started. Use the "Create Project" button in the sidebar.
            </Text>
          </Container>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => navigate(`/projects/${project.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </SingleColumnPage>
  );
}

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
}

/**
 * Project card component with improved styling, brand identity, and status indicators
 */
function ProjectCard({ project, onClick }: ProjectCardProps) {
  const stepInfo = getStepInfo(project.current_step);
  const formattedDate = new Date(project.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const primaryColor = project.primary_color || "#0F172A";
  const secondaryColor = project.secondary_color || "#3B82F6";

  return (
    <Container
      className="p-0 hover:shadow-elevation-card-hover cursor-pointer transition-all group border border-ui-border-base overflow-hidden"
      onClick={onClick}
    >
      {/* Brand Color Header Bar */}
      <div 
        className="h-2 w-full"
        style={{ 
          background: `linear-gradient(90deg, ${primaryColor} 0%, ${secondaryColor} 100%)` 
        }}
      />
      
      <div className="p-4 flex flex-col gap-y-3">
        {/* Header with logo and status */}
        <div className="flex items-start justify-between gap-x-3">
          {/* Logo */}
          {project.logo_url ? (
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              <img 
                src={project.logo_url} 
                alt="Logo" 
                className="w-7 h-7 object-contain"
              />
            </div>
          ) : (
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: primaryColor }}
            >
              <span className="text-white text-sm font-bold">
                {project.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <Heading level="h3" className="truncate group-hover:text-ui-fg-interactive transition-colors">
              {project.name}
            </Heading>
            {/* Brand Colors Indicator */}
            {project.primary_color && (
              <div className="flex items-center gap-x-1 mt-1">
                <div 
                  className="w-3 h-3 rounded-full border border-ui-border-base" 
                  style={{ backgroundColor: primaryColor }}
                />
                <div 
                  className="w-3 h-3 rounded-full border border-ui-border-base" 
                  style={{ backgroundColor: secondaryColor }}
                />
              </div>
            )}
          </div>
          
          <div className="flex-shrink-0">
            {stepInfo.icon}
          </div>
        </div>

        {/* Description */}
        {project.description && (
          <Text size="small" className="text-ui-fg-subtle line-clamp-2">
            {project.description}
          </Text>
        )}

        {/* Status badge */}
        <div className="flex items-center gap-x-2">
          <StatusBadge color={stepInfo.color} size="small">
            {stepInfo.label}
          </StatusBadge>
        </div>

        {/* Footer with date and arrow */}
        <div className="flex items-center justify-between pt-2 border-t border-ui-border-base">
          <div className="flex items-center gap-x-1.5">
            <Calendar className="w-3.5 h-3.5 text-ui-fg-muted" />
            <Text size="xsmall" className="text-ui-fg-muted">
              {formattedDate}
            </Text>
          </div>
          <ArrowRight className="w-4 h-4 text-ui-fg-muted group-hover:text-ui-fg-interactive transition-colors" />
        </div>
      </div>
    </Container>
  );
}

/**
 * Get step information including icon, label, and color
 */
function getStepInfo(step: ProjectStep): {
  icon: ReactNode;
  label: string;
  color: "green" | "blue" | "grey" | "orange";
} {
  const stepMap: Record<
    ProjectStep,
    { icon: ReactNode; label: string; color: "green" | "blue" | "grey" | "orange" | "purple" }
  > = {
    chat: {
      icon: <CircleDottedLine className="w-4 h-4 text-ui-fg-muted" />,
      label: "Requirements",
      color: "grey",
    },
    planning: {
      icon: <CircleHalfSolid className="w-4 h-4 text-ui-fg-interactive" />,
      label: "Planning",
      color: "blue",
    },
    identityGenerating: {
      icon: <CircleHalfSolid className="w-4 h-4 text-purple-500" />,
      label: "Brand Identity",
      color: "purple",
    },
    assetsImagesGenerating: {
      icon: <CircleHalfSolid className="w-4 h-4 text-ui-fg-interactive" />,
      label: "Generating Images",
      color: "blue",
    },
    sourcing: {
      icon: <CircleHalfSolid className="w-4 h-4 text-ui-fg-interactive" />,
      label: "Sourcing",
      color: "blue",
    },
    negotiating: {
      icon: <CircleHalfSolid className="w-4 h-4 text-ui-fg-interactive" />,
      label: "Negotiating",
      color: "blue",
    },
    cost_analysing: {
      icon: <CircleHalfSolid className="w-4 h-4 text-ui-fg-interactive" />,
      label: "Cost Analysis",
      color: "blue",
    },
    layoutGenerating: {
      icon: <CircleHalfSolid className="w-4 h-4 text-ui-fg-interactive" />,
      label: "Layout Generation",
      color: "blue",
    },
    completed: {
      icon: <CheckCircleSolid className="w-4 h-4 text-ui-tag-green-text" />,
      label: "Completed",
      color: "green",
    },
  };

  return stepMap[step] || {
    icon: <CircleDottedLine className="w-4 h-4 text-ui-fg-muted" />,
    label: step,
    color: "grey",
  };
}
