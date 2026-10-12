import { useCallback, useState } from 'react';
import { MDPFlowCanvas } from './components/canvas/MDPFlowCanvas';
import { AppHeader } from './components/layout/AppHeader';
import { InspectorPanel } from './components/inspector/InspectorPanel';
import { ToolbarPanel } from './components/sidebar/ToolbarPanel';
import { PoliciesPanel } from './components/sidebar/PoliciesPanel';
import { ProbabilitiesPanel } from './components/sidebar/ProbabilitiesPanel';
import { TargetCXpPanel } from './components/sidebar/TargetCXpPanel';
import { useMDP, DEFAULT_NODE_SIZE } from './hooks/useMDP';
import { exportMDPToFile, importMDPFromFile } from './core/serializers/jsonSerializer';
import { exportMDPToMiniZincDzn } from './core/serializers/minizincSerializer';
import type { ExplanationHighlight } from './types/explanation';

function App() {
  const {
    title,
    states,
    actions,
    transitions,
    nodePositions,
    nodeSizes,
    actionPositions,
    setTitle,
    addState,
    updateState,
    removeState,
    addActionWithState,
    updateAction,
    removeAction,
    addTransition,
    addStateWithAction,
    updateTransition,
    removeTransition,
    updateNodePosition,
    updateNodeSize,
    updateActionPosition,
    loadMDPFromJSON,
    resetMDP,
  } = useMDP();

  const [selectedStateId, setSelectedStateId] = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [selectedTransitionId, setSelectedTransitionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [explanationHighlight, setExplanationHighlight] = useState<ExplanationHighlight | null>(null);

  const selectedState = states.find((state) => state.id === selectedStateId) ?? null;
  const selectedStateSize = selectedState ? (nodeSizes[selectedState.id] ?? DEFAULT_NODE_SIZE) : null;
  const selectedAction = actions.find((action) => action.id === selectedActionId) ?? null;
  const selectedTransition = transitions.find((transition) => transition.id === selectedTransitionId) ?? null;

  const handleSave = useCallback(async () => {
    try {
      await exportMDPToFile(states, actions, transitions, nodePositions, title, nodeSizes, actionPositions);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Failed to save the MDP file.');
    }
  }, [states, actions, transitions, nodePositions, title, nodeSizes, actionPositions]);

  const handleExportMiniZinc = useCallback(async () => {
    try {
      await exportMDPToMiniZincDzn(states, actions, transitions, title);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Failed to export the MiniZinc data file.');
    }
  }, [states, actions, transitions, title]);

  const handleOpen = useCallback(
    async (file: File) => {
      try {
        const data = await importMDPFromFile(file);
        loadMDPFromJSON(data);
        setSelectedStateId(null);
        setSelectedActionId(null);
        setSelectedTransitionId(null);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Failed to open the MDP file.');
      }
    },
    [loadMDPFromJSON]
  );

  const handleReset = useCallback(() => {
    resetMDP();
    setSelectedStateId(null);
    setSelectedActionId(null);
    setSelectedTransitionId(null);
  }, [resetMDP]);

  const handleSelectState = useCallback((stateId: string) => {
    setSelectedStateId(stateId);
    setSelectedActionId(null);
    setSelectedTransitionId(null);
  }, []);

  const handleSelectAction = useCallback((actionId: string) => {
    setSelectedActionId(actionId);
    setSelectedStateId(null);
    setSelectedTransitionId(null);
  }, []);

  const handleSelectTransition = useCallback((transitionId: string) => {
    setSelectedTransitionId(transitionId);
    setSelectedStateId(null);
    setSelectedActionId(null);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedStateId(null);
    setSelectedActionId(null);
    setSelectedTransitionId(null);
  }, []);

  const handleDeleteState = useCallback(
    (stateId: string) => {
      removeState(stateId);
      setSelectedStateId(null);
    },
    [removeState]
  );

  const handleDeleteAction = useCallback(
    (actionId: string) => {
      removeAction(actionId);
      setSelectedActionId(null);
    },
    [removeAction]
  );

  const handleDeleteTransition = useCallback(
    (transitionId: string) => {
      removeTransition(transitionId);
      setSelectedTransitionId(null);
    },
    [removeTransition]
  );

  const handleConnectStateToAction = useCallback(
    (stateId: string, actionId: string) => {
      updateAction(actionId, { sourceStateId: stateId });
    },
    [updateAction]
  );

  const handleConnectActionToState = useCallback(
    (actionId: string, stateId: string) => {
      addTransition(actionId, stateId, 1);
    },
    [addTransition]
  );

  return (
    <div className="app-container">
      <AppHeader
        title={title}
        isSidebarOpen={isSidebarOpen}
        onTitleChange={setTitle}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
      />

      <div className="app-body">
        {/* Kept mounted while closed so the panels don't lose their open sections and computed results. */}
        <aside id="app-sidebar" className={`sidebar${isSidebarOpen ? '' : ' sidebar--closed'}`}>
          <ToolbarPanel
            onSave={handleSave}
            onOpen={handleOpen}
            onReset={handleReset}
            onExportMiniZinc={handleExportMiniZinc}
          />

          <PoliciesPanel
            states={states}
            actions={actions}
            transitions={transitions}
            selectedStateId={selectedStateId}
            onUpdateAction={updateAction}
          />

          <ProbabilitiesPanel
            states={states}
            actions={actions}
            transitions={transitions}
            selectedStateId={selectedStateId}
          />

          <TargetCXpPanel
            states={states}
            actions={actions}
            transitions={transitions}
            highlight={explanationHighlight}
            onHighlightChange={setExplanationHighlight}
          />
        </aside>

        <main className="canvas-area">
          <MDPFlowCanvas
            states={states}
            actions={actions}
            transitions={transitions}
            nodePositions={nodePositions}
            nodeSizes={nodeSizes}
            actionPositions={actionPositions}
            selectedStateId={selectedStateId}
            selectedActionId={selectedActionId}
            selectedTransitionId={selectedTransitionId}
            explanationHighlight={explanationHighlight}
            onNodeDragStop={updateNodePosition}
            onActionDragStop={updateActionPosition}
            onNodeResize={updateNodeSize}
            onSelectState={handleSelectState}
            onSelectAction={handleSelectAction}
            onSelectTransition={handleSelectTransition}
            onClearSelection={handleClearSelection}
            onAddState={addState}
            onConnectStateToAction={handleConnectStateToAction}
            onConnectActionToState={handleConnectActionToState}
            onCreateActionFromState={addActionWithState}
            onCreateStateFromAction={addStateWithAction}
            onDeleteState={handleDeleteState}
            onDeleteAction={handleDeleteAction}
            onDeleteTransition={handleDeleteTransition}
            onUpdateTransition={updateTransition}
          />

          <InspectorPanel
            selectedState={selectedState}
            selectedAction={selectedAction}
            selectedTransition={selectedTransition}
            actions={actions}
            states={states}
            stateSize={selectedStateSize}
            onUpdateState={updateState}
            onUpdateStateSize={updateNodeSize}
            onUpdateAction={updateAction}
            onUpdateTransition={updateTransition}
            onDeleteState={handleDeleteState}
            onDeleteAction={handleDeleteAction}
            onDeleteTransition={handleDeleteTransition}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
