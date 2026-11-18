import React, { useState, useCallback } from 'react';
import { Text, Box, useInput, useApp } from 'ink';
import { existsSync } from 'node:fs';
import { saveConfig, validateProject, type Config, type ProjectConfig } from './config.js';

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

type Phase = 'check-existing' | 'form' | 'confirm-another' | 'done';

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

  const currentField = FIELDS[fieldIndex];

  const finishSetup = useCallback((finalProjects: ProjectConfig[]) => {
    const config: Config = {
      projects: finalProjects,
      github: { pollIntervalSeconds: 60 },
    };
    saveConfig(config, configPath);
    setPhase('done');
    setTimeout(() => exit(), 100);
  }, [configPath, exit]);

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
      const taken = projects.map(p => p.prefix);
      if (taken.includes(value)) {
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
      setFieldIndex(fieldIndex + 1);
    } else {
      const project = updated as ProjectConfig;
      const validationErrors = validateProject(project, projects.map(p => p.prefix));
      if (validationErrors.length > 0) {
        setError(validationErrors.join(', '));
        return;
      }
      setProjects(prev => [...prev, project]);
      setDraft({});
      setFieldIndex(0);
      setPhase('confirm-another');
    }
  }, [input, currentField, draft, fieldIndex, projects]);

  useInput((ch, key) => {
    if (phase === 'check-existing') {
      if (ch === 'o' || ch === 'O') {
        setExistingChoice('overwrite');
        setPhase('form');
      } else if (ch === 'c' || ch === 'C') {
        setPhase('done');
        setTimeout(() => exit(), 100);
      }
      return;
    }

    if (phase === 'confirm-another') {
      if (ch === 'y' || ch === 'Y') {
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
        <Text>[o] Overwrite  [c] Cancel</Text>
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
      {projects.length > 0 && (
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
