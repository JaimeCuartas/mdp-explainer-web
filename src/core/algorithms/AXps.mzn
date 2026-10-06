enum states;
enum actions;

array[states,actions,states] of float: R;

array[states, actions, states] of float: P;

var float: g;

set of states: effect_states;
states: init_state;
array[states, actions] of float: policy;

% --- Parámetros de tolerancia ---
float: p0 = 0.65; % First probability
float: tolerance = 0.20;
float: min_threshold = p0 * (1.0 - tolerance);        % 0.52
float: max_threshold = min(1.0, p0 * (1.0 + tolerance)); % 0.78

set of states: non_effect_states = states diff effect_states;

% --- Variables del Problema de Explicación ---
% in_AXp[s] = true indica que el estado 's' pertenece a la explicación (su política se congela)
array[states] of var bool: in_AXp;

% Variables de alcanzabilidad para el peor y mejor caso
array[states] of var 0.0..1.0: reach_min;
array[states] of var 0.0..1.0: reach_max;

% 1. Caso base: Estados de efecto siempre tienen probabilidad 1.0
constraint forall(s in effect_states) (
    reach_min[s] = 1.0 /\ reach_max[s] = 1.0
);

% 2. Evaluación de PEOR CASO (reach_min)
constraint
    forall(s in non_effect_states) (
        reach_min[s] = if in_AXp[s] then
            % If it is in AXP then compute the reachability
            sum(a in actions)(policy[s, a] * sum(s_ in states)(P[s, a, s_] * reach_min[s_]))
        else
            % If it is not in AXp, then try to minimise
            min(a in actions)(sum(s_ in states)(P[s, a, s_] * reach_min[s_]))
        endif
    );

% 3. Evaluación de MEJOR CASO (reach_max)
constraint
    forall(s in non_effect_states) (
        reach_max[s] = if in_AXp[s] then
            % Si está en la AXp, sigue la política fija
            sum(a in actions)(policy[s, a] * sum(s_ in states)(P[s, a, s_] * reach_max[s_]))
        else
            % Si no está en la AXp, elije la acción adversa que MAXIMIZA la probabilidad
            max(a in actions)(sum(s_ in states)(P[s, a, s_] * reach_max[s_]))
        endif
    );

% 4. Criterio de la AXp: El rango [reach_min, reach_max] debe permanecer dentro de la tolerancia
constraint reach_min[init_state] >= min_threshold;
constraint reach_max[init_state] <= max_threshold;

% --- Función Objetivo: Minimizar el tamaño del conjunto explicativo (AXp) ---
constraint not in_AXp[states[3]];
solve minimize sum(s in states)(bool2int(in_AXp[s]));

output [
    "--- AXp Encontrada ---\n",
    "init state ", show(init_state), "\n",
    "Tamaño de AXp: ", show(sum(s in states)(bool2int(in_AXp[s]))), "\n",
    "Estados en AXp: ", show([s | s in states where fix(in_AXp[s])]), "\n",
    "Rango de probabilidad en init_state: [", show(reach_min[init_state]), " , ", show(reach_max[init_state]), "]\n"
];