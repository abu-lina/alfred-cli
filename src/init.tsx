import React, { useState, useCallback, useEffect } from 'react';
import { Text, Box, useInput, useApp } from 'ink';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadConfig, saveConfig, validateProject, type Config, type ProjectConfig } from './config.js';

interface Props {
  configPath: string;
}

type Field = 'name' | 'prefix' | 'path' | 'repo' | 'rexSession';

const FIELDS: { key: Field; label: string; placeholder: string }[] = [
  { key: 'name', label: 'Project name', placeholder: 'my-project' },
  { key: 'prefix', label: '2-letter prefix', placeholder: 'MP' },
  { key: 'path', label: 'Local path', placeholder: '/Users/you/projects/my-project' },
  { key: 'repo', label: 'GitHub repo', placeholder: 'owner/my-project' },
  { key: 'rexSession', label: 'Rex session name', placeholder: 'my-project-foreman' },
];

type Phase = 'check-existing' | 'form' | 'validating' | 'validation-error' | 'confirm-another' | 'done';

export function Init({ configPath }: Props) {
  const { exit } = useApp();
  const configExists = existsSync(configPath);

  const [phase, setPhase] = useState<Phase>(configExists ? 'check-existing' : 'form');
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [fieldIndex, setFieldIndex] = useState(0);
  const [input, setInput] = useState('');
  const [draft, setDraft] = useState<Partial<ProjectConfig>>({});
  const [error, setError] = useState('');
  const [existingChoice, setExistingChoice] = useState('');
  const [editIndex, setEditIndex] = useState(-1);
  const [loadedConfig, setLoadedConfig] = useState<Config | null>(null);
  const [pendingProject, setPendingProject] = useState<ProjectConfig | null>(null);
  const [validationErrorField, setValidationErrorField] = useState<number>(-1);

  const currentField = FIELDS[fieldIndex];

  const finishSetup = useCallback((finalProjects: ProjectConfig[]) => {
    const config: Config = {
      ...loadedConfig,
      projects: finalProjects,
      github: loadedConfig?.github ?? { pollIntervalSeconds: 60 },
    };
    saveConfig(config, configPath);
    setPhase('done');
    setTimeout(() => exit(), 100);
  }, [configPath, exit, loadedConfig]);

  const prefillField = useCallback((project: ProjectConfig, fIdx: number) => {
    const field = FIELDS[fIdx];
    if (field) {
      setInput(project[field.key]);
    }
  }, []);

  const startEditProject = useCallback((proj: ProjectConfig, idx: number) => {
    setEditIndex(idx);
    setDraft({});
    setFieldIndex(0);
    prefillField(proj, 0);
    setPhase('form');
  }, [prefillField]);

  const acceptProject = useCallback((project: ProjectConfig) => {
    if (editIndex >= 0 && editIndex < projects.length) {
      setProjects(prev => prev.map((p, i) => i === editIndex ? project : p));
      const nextEdit = editIndex + 1;
      if (nextEdit < projects.length) {
        startEditProject(projects[nextEdit]!, nextEdit);
        return;
      }
      setEditIndex(-1);
      setDraft({});
      setFieldIndex(0);
      setInput('');
      setPhase('confirm-another');
    } else {
      setProjects(prev => [...prev, project]);
      setEditIndex(-1);
      setDraft({});
      setFieldIndex(0);
      setPhase('confirm-another');
    }
  }, [editIndex, projects, startEditProject]);

  // Run runtime validation when phase enters 'validating'
  useEffect(() => {
    if (phase !== 'validating' || !pendingProject) return;

    // Check path exists on disk
    if (!existsSync(pendingProject.path)) {
      setError(`Path does not exist: ${pendingProject.path}`);
      setValidationErrorField(FIELDS.findIndex(f => f.key === 'path'));
      setPhase('validation-error');
      return;
    }

    // Check repo accessible via gh
    try {
      execFileSync('gh', ['repo', 'view', pendingProject.repo], {
        stdio: 'ignore',
        env: { ...process.env, GH_HOST: '' },
      });
    } catch {
      setError(`Repository not accessible: ${pendingProject.repo}`);
      setValidationErrorField(FIELDS.findIndex(f => f.key === 'repo'));
      setPhase('validation-error');
      return;
    }

    // All good - accept the project
    acceptProject(pendingProject);
    setPendingProject(null);
  }, [phase, pendingProject, acceptProject]);

  const submitField = useCallback(() => {
    if (!currentField) return;
    const value = input.trim();
    if (!value) {
      setError(`${currentField.label} cannot be empty`);
      setInput('');
      return;
    }

    const updated = { ...draft, [currentField.key]: value } as Partial<ProjectConfig>;

    if (currentField.key === 'prefix') {
      if (!/^[A-Z]{2}$/.test(value)) {
        setError('prefix must be 2 uppercase letters');
        setInput('');
        return;
      }
      const otherPrefixes = projects
        .filter((_, i) => i !== editIndex)
        .map(p => p.prefix);
      if (otherPrefixes.includes(value)) {
        setError(`prefix "${value}" is already in use`);
        setInput('');
        return;
      }
    }

    if (currentField.key === 'path' && !value.startsWith('/')) {
      setError('path must be an absolute path');
      setInput('');
      return;
    }

    if (currentField.key === 'repo' && !/^[^/]+\/[^/]+$/.test(value)) {
      setError('repo must be in owner/name format');
      setInput('');
      return;
    }

    setDraft(updated);
    setError('');
    setInput('');

    if (fieldIndex < FIELDS.length - 1) {
      const nextIdx = fieldIndex + 1;
      setFieldIndex(nextIdx);
      if (editIndex >= 0 && editIndex < projects.length) {
        prefillField(projects[editIndex]!, nextIdx);
      }
    } else {
      const project = updated as ProjectConfig;
      const otherPrefixes = projects
        .filter((_, i) => i !== editIndex)
        .map(p => p.prefix);
      const validationErrors = validateProject(project, otherPrefixes);
      if (validationErrors.length > 0) {
        setError(validationErrors.join(', '));
        return;
      }
      // Enter runtime validation phase
      setPendingProject(project);
      setPhase('validating');
    }
  }, [input, currentField, draft, fieldIndex, projects, editIndex, prefillField, startEditProject]);

  useInput((ch, key) => {
    if (phase === 'check-existing') {
      if (ch === 'o' || ch === 'O') {
        setExistingChoice('overwrite');
        setPhase('form');
      } else if (ch === 'e' || ch === 'E') {
        try {
          const existing = loadConfig(configPath);
          setLoadedConfig(existing);
          setExistingChoice('edit');
          setProjects(existing.projects);
          startEditProject(existing.projects[0]!, 0);
        } catch {
          setError('Failed to load existing config');
        }
      } else if (ch === 'c' || ch === 'C') {
        setPhase('done');
        setTimeout(() => exit(), 100);
      }
      return;
    }

    if (phase === 'validation-error') {
      if (key.return) {
        setPhase('form');
        setFieldIndex(validationErrorField);
        setInput(pendingProject ? pendingProject[FIELDS[validationErrorField]!.key] : '');
        if (pendingProject) {
          const restored: Partial<ProjectConfig> = {};
          for (let i = 0; i < validationErrorField; i++) {
            const f = FIELDS[i]!;
            restored[f.key] = pendingProject[f.key];
          }
          setDraft(restored);
        }
        setError('');
        setPendingProject(null);
      }
      return;
    }

    if (phase === 'confirm-another') {
      if (ch === 'y' || ch === 'Y') {
        setEditIndex(-1);
        setPhase('form');
      } else if (ch === 'n' || ch === 'N') {
        finishSetup(projects);
      }
      return;
    }

    if (phase !== 'form') return;

    if (key.return) {
      submitField();
    } else if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1));
    } else if (ch && !key.ctrl && !key.meta) {
      setInput(prev => prev + ch);
    }
  });

  if (phase === 'done') {
    if (existingChoice === '' && !existsSync(configPath)) {
      return <Text>Cancelled.</Text>;
    }
    return (
      <Box flexDirection="column">
        <Text color="green">Config saved to {configPath}</Text>
      </Box>
    );
  }

  if (phase === 'check-existing') {
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">Alfred CLI Setup</Text>
        <Text>Config already exists at {configPath}</Text>
        <Text>[o] Overwrite  [e] Edit  [c] Cancel</Text>
      </Box>
    );
  }

  if (phase === 'validating') {
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">Alfred CLI Setup</Text>
        <Text color="yellow">Validating project...</Text>
      </Box>
    );
  }

  if (phase === 'validation-error') {
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">Alfred CLI Setup</Text>
        <Text color="red">{error}</Text>
        <Text dimColor>Press Enter to correct</Text>
      </Box>
    );
  }

  if (phase === 'confirm-another') {
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">Alfred CLI Setup</Text>
        <Text color="green">Added {projects[projects.length - 1]!.name} ({projects[projects.length - 1]!.prefix})</Text>
        <Text>Add another project? [y/n]</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">Alfred CLI Setup</Text>
      {editIndex >= 0 && editIndex < projects.length && (
        <Text dimColor>Editing project: {projects[editIndex]!.name}</Text>
      )}
      {projects.length > 0 && editIndex < 0 && (
        <Text dimColor>{projects.length} project(s) added</Text>
      )}
      {error && <Text color="red">{error}</Text>}
      <Box>
        <Text>{currentField!.label}: </Text>
        <Text color="yellow">{input}</Text>
        <Text dimColor>{input ? '' : ` (${currentField!.placeholder})`}</Text>
      </Box>
    </Box>
  );
}
