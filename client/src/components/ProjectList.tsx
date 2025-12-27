/**
 * ProjectList component
 * Displays list of all projects with their status
 */

import React from 'react';
import { Project } from '../types/index';
import './ProjectList.css';

interface ProjectListProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
}

const ProjectList: React.FC<ProjectListProps> = ({ projects, onSelectProject }) => {
  const getStatusLabel = (status: Project['status']): string => {
    const labels: Record<Project['status'], string> = {
      DATA_COLLECTING: 'Collecting Data',
      CREATING_PROCCES: 'Creating Process',
      MACHINES_REASERCH: 'Researching Machines',
      MACHINES_GENERATED: 'Machines Generated',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: Project['status']): string => {
    const colors: Record<Project['status'], string> = {
      DATA_COLLECTING: '#3b82f6',
      CREATING_PROCCES: '#8b5cf6',
      MACHINES_REASERCH: '#f59e0b',
      MACHINES_GENERATED: '#10b981',
    };
    return colors[status] || '#6b7280';
  };

  if (projects.length === 0) {
    return (
      <div className="project-list-empty">
        <p>No projects yet. Create your first project to get started!</p>
      </div>
    );
  }

  return (
    <div className="project-list">
      <h2>Your Projects</h2>
      <div className="project-grid">
        {projects.map((project) => (
          <div
            key={project.id}
            className="project-card"
            onClick={() => onSelectProject(project)}
          >
            <div className="project-card-header">
              <h3>{project.name}</h3>
              <span
                className="project-status-badge"
                style={{ backgroundColor: getStatusColor(project.status) }}
              >
                {getStatusLabel(project.status)}
              </span>
            </div>
            {project.description && (
              <p className="project-description">{project.description}</p>
            )}
            <div className="project-card-footer">
              <span className="project-date">
                Created: {new Date(project.created_at).toLocaleDateString()}
              </span>
              {project.updated_at !== project.created_at && (
                <span className="project-date">
                  Updated: {new Date(project.updated_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectList;

