# Work Item Assistant

This module provides a modular implementation for the work item form and related features.

## Architecture

The `WorkItemAssistant` feature is organized with modern React best practices following a modular structure:

```
workItemAssistant/
├── components/          # UI components
│   ├── EditDialog.tsx   # Dialog for editing work items
│   ├── RefinementModal.tsx # Modal for AI refinements
│   ├── WorkItemCard.tsx # Component for a single work item
│   └── WorkItemForm.tsx # Main work item form
├── context/
│   └── WorkItemContext.tsx # Context for state management
├── hooks/
│   ├── useWorkItemParsing.ts    # Hook for parsing JSON plans
│   └── useWorkItemRefinement.ts # Hook for AI refinement features
├── i18n/
│   └── translations.ts  # Internationalization translations
├── types/
│   └── WorkItemTypes.ts # TypeScript type definitions
├── index.ts            # Main export file
└── README.md           # Documentation
```

## Usage

To use the `WorkItemForm` component:

```tsx
import { WorkItemForm } from '../../features/workItemAssistant';

const MyComponent = () => {
  const handleSubmit = (workItems) => {
    // Do something with the work items
  };

  return (
    <WorkItemForm
      jsonPlan={jsonPlanString}
      onClose={handleClose}
      onSubmit={handleSubmit}
      currentLanguage="en"
      availableTypes={['Epic', 'Feature', 'User Story', 'Task', 'Bug']}
      teamMapping={teamMappingConfig}
    />
  );
};
```

## Features

- Modular component architecture
- Context API for state management
- Custom hooks for logic separation
- TypeScript for type safety
- AI-powered refinement of work item fields
- Internationalization support (English and Turkish)
- Nested work item hierarchies (parent-child relationships)
- Dynamic form fields based on work item type

## State Management

The component uses React Context API for state management. The main state is managed in `WorkItemContext.tsx`, which provides:

- Work items array with nested children
- Error handling
- Modal states (edit dialog, refinement modal)
- Notification management

## AI Refinement

The AI refinement features are abstracted into the `useWorkItemRefinement` hook, which:

- Handles API calls to LLM services
- Processes prompts for different field types
- Handles success/failure states
- Applies refined values to the work items

## Customization

The form can be customized through the props:

- `availableTypes`: Control the types of work items available
- `teamMapping`: Provide configuration for work item types and fields
- `currentLanguage`: Set the language for the UI 