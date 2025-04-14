import {
    ArrowDropDown as ArrowDropDownIcon,
    ArrowRight as ArrowRightIcon,
    Article as ArticleIcon,
    Edit as EditIcon
} from '@mui/icons-material';
import {
    Box,
    Checkbox,
    Collapse,
    IconButton,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Tooltip,
    Typography
} from '@mui/material';
import React, { useState } from 'react';
import { Language } from '../../../translations';
import { getTranslations } from '../i18n/translations';
import { WorkItemFieldConfig, WorkItemTypeConfig } from '../services/WorkItemSettingsService';

interface WorkItemTypeHierarchyProps {
  workItemTypes: WorkItemTypeConfig[];
  onChange: (newWorkItemTypes: WorkItemTypeConfig[]) => void;
  currentLanguage: Language;
  onEditFields?: (typeName: string, fields: WorkItemFieldConfig[]) => void;
}

/**
 * Display work item types in a hierarchical collapsible structure
 */
export const WorkItemTypeHierarchy: React.FC<WorkItemTypeHierarchyProps> = ({
  workItemTypes,
  onChange,
  currentLanguage,
  onEditFields
}) => {
  const translations = getTranslations(currentLanguage);
  
  // Track expanded state for each type
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});
  
  // Calculate the hierarchy levels
  const getHierarchyLevels = (): Record<string, WorkItemTypeConfig[]> => {
    // Group types by parent-child relationships
    const result: Record<string, WorkItemTypeConfig[]> = {
      'root': []
    };
    
    // Create a map of parent type to child types
    const parentToChildren: Record<string, string[]> = {};
    
    // First, identify all parent-child relationships
    workItemTypes.forEach(type => {
      if (type.childTypes && type.childTypes.length > 0) {
        parentToChildren[type.name] = [...type.childTypes];
      }
    });
    
    // Find root types that aren't children of any other type
    const allChildTypes = Object.values(parentToChildren).flat();
    const rootTypes = workItemTypes.filter(type => 
      !allChildTypes.includes(type.name)
    );
    
    // If no clear root types, treat all types as roots
    if (rootTypes.length === 0) {
      // Try to identify common root types
      const commonRootTypes = ['Epic', 'Initiative', 'Theme'];
      
      // Find any of these common root types that exist in our work item types
      const potentialRoots = workItemTypes.filter(type => 
        commonRootTypes.includes(type.name)
      );
      
      if (potentialRoots.length > 0) {
        // Use these as root types
        result['root'] = potentialRoots;
      } else {
        // Last resort - treat all types as roots
        result['root'] = [...workItemTypes];
      }
      return result;
    }
    
    // Set the root types
    result['root'] = rootTypes;
    
    // For each parent, create a group for its children
    Object.keys(parentToChildren).forEach(parent => {
      const childTypeNames = parentToChildren[parent];
      result[parent] = workItemTypes.filter(type => 
        childTypeNames.includes(type.name)
      );
    });
    
    return result;
  };
  
  const hierarchyLevels = getHierarchyLevels();
  
  // Toggle a type's expanded state
  const toggleExpanded = (typeName: string) => {
    setExpandedTypes(prev => ({
      ...prev,
      [typeName]: !prev[typeName]
    }));
  };
  
  // Handle enabling/disabling a type
  const handleToggleEnabled = (typeIndex: number) => {
    const newWorkItemTypes = [...workItemTypes];
    newWorkItemTypes[typeIndex].enabled = !newWorkItemTypes[typeIndex].enabled;
    onChange(newWorkItemTypes);
  };
  
  // Find the index of a type by name
  const findTypeIndex = (typeName: string): number => {
    return workItemTypes.findIndex(t => t.name === typeName);
  };
  
  // Get root types and specifically identify Epic and Bug
  const rootTypes = hierarchyLevels['root'] || [];
  const epicType = rootTypes.find(type => type.name === 'Epic');
  const bugType = rootTypes.find(type => type.name === 'Bug');
  const otherTypes = rootTypes.filter(type => type.name !== 'Epic' && type.name !== 'Bug');
  
  // Initialize Epic and Bug as expanded by default
  React.useEffect(() => {
    setExpandedTypes(prev => ({
      ...prev,
      'Epic': true,
      'Bug': true
    }));
  }, []);
  
  // Render a single work item type with its children
  const renderWorkItemType = (type: WorkItemTypeConfig, level: number = 0, isLastChild: boolean = true, parentLastChild: boolean[] = [], isMainHierarchy: boolean = true) => {
    const typeIndex = findTypeIndex(type.name);
    const hasChildren = hierarchyLevels[type.name]?.length > 0;
    const isExpanded = expandedTypes[type.name] || false;
    
    const childItems = hierarchyLevels[type.name] || [];
    
    return (
      <React.Fragment key={type.name}>
        <ListItem
          sx={{ 
            pl: level > 0 ? 2 : 1, 
            position: 'relative',
            pt: 0.5,
            pb: 0.5,
            backgroundColor: isMainHierarchy 
              ? (level % 2 === 0 ? 'rgba(25, 118, 210, 0.04)' : 'transparent')
              : (level % 2 === 0 ? 'rgba(211, 47, 47, 0.04)' : 'transparent'),
            borderRadius: level === 0 ? 1 : 0,
            '&:hover': {
              backgroundColor: isMainHierarchy 
                ? 'rgba(25, 118, 210, 0.08)'
                : 'rgba(211, 47, 47, 0.08)',
            }
          }}
        >
          {/* Vertical connector lines from parent items */}
          {level > 0 && parentLastChild.map((isLast, idx) => (
            idx < level - 1 && !isLast && (
              <Box
                key={`vline-${idx}`}
                sx={{
                  position: 'absolute',
                  left: `${(idx + 1) * 24 + 6}px`,
                  top: 0,
                  bottom: 0,
                  width: '1px',
                  bgcolor: isMainHierarchy ? 'primary.light' : 'error.light',
                  opacity: 0.5,
                  zIndex: 1
                }}
              />
            )
          ))}
          
          {/* Horizontal connector line to current item */}
          {level > 0 && (
            <Box
              sx={{
                position: 'absolute',
                left: `${(level - 1) * 24 + 6}px`,
                width: '18px',
                height: '1px',
                bgcolor: isMainHierarchy ? 'primary.light' : 'error.light',
                opacity: 0.5,
                top: '50%',
                zIndex: 1
              }}
            />
          )}
          
          {/* Expand/collapse or leaf icon with proper indentation */}
          <Box sx={{ display: 'flex', ml: level * 2 }}>
            {hasChildren ? (
              <IconButton 
                size="small" 
                onClick={() => toggleExpanded(type.name)}
                sx={{ mr: 0.5 }}
              >
                {isExpanded ? <ArrowDropDownIcon /> : <ArrowRightIcon />}
              </IconButton>
            ) : (
              <Box sx={{ width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArticleIcon color="disabled" fontSize="small" />
              </Box>
            )}
          </Box>
          
          <ListItemIcon sx={{ minWidth: 36 }}>
            <Checkbox
              edge="start"
              checked={type.enabled}
              onChange={() => handleToggleEnabled(typeIndex)}
              tabIndex={-1}
              disableRipple
              color={isMainHierarchy ? "primary" : "error"}
            />
          </ListItemIcon>
          
          <ListItemText
            primary={
              <Typography 
                sx={{ 
                  fontWeight: type.enabled ? 'bold' : 'normal',
                  color: type.enabled ? 'text.primary' : 'text.secondary'
                }}
              >
                {type.name}
              </Typography>
            }
            secondary={
              type.enabled ? (
                <Typography variant="caption" color="text.secondary">
                  {type.fields.filter(f => f.enabled).length} {translations.fieldsActive}
                </Typography>
              ) : null
            }
          />
          
          {onEditFields && (
            <Tooltip title={translations.editFields}>
              <IconButton 
                size="small" 
                onClick={() => {
                  console.log(`Edit Fields clicked for ${type.name} with ${type.fields.length} fields`);
                  onEditFields(type.name, type.fields);
                }}
                color={isMainHierarchy ? "primary" : "error"}
                sx={{
                  border: '1px solid',
                  borderColor: isMainHierarchy ? 'primary.main' : 'error.main',
                  ml: 1,
                  '&:hover': {
                    bgcolor: isMainHierarchy ? 'primary.light' : 'error.light',
                    color: 'primary.contrastText'
                  }
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </ListItem>
        
        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {childItems.map((childType, idx) => 
                renderWorkItemType(
                  childType, 
                  level + 1, 
                  idx === childItems.length - 1,
                  [...parentLastChild, isLastChild],
                  isMainHierarchy
                )
              )}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };
  
  return (
    <div>
      <Typography variant="subtitle1" fontWeight="bold">
        {translations.hierarchy ? `${translations.hierarchy} 1` : 'Hierarchy 1'}
      </Typography>
      <List component="div" disablePadding>
        {epicType && renderWorkItemType(epicType, 0, true)}
      </List>
      
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 3 }}>
        {translations.hierarchy ? `${translations.hierarchy} 2` : 'Hierarchy 2'}
      </Typography>
      <List component="div" disablePadding>
        {bugType && renderWorkItemType(bugType, 0, true)}
      </List>
      
      {otherTypes.length > 0 && (
        <>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 3 }}>
            {translations.workItemType ? translations.workItemType : 'Other Work Item Types'}
          </Typography>
          <List component="div" disablePadding>
            {otherTypes.map((type) => renderWorkItemType(type, 0, false))}
          </List>
        </>
      )}
    </div>
  );
}; 