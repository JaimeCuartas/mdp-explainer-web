enum states;
enum actions;

array[states,actions,states] of float: R;

array[states, actions, states] of float: P;

var float: g;

set of states: effect_states;
states: init_state;
array[states, actions] of float: policy;

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
float: p0 = 0.8;

float: tolerance = 0.60;

float: min_threshold = p0 * (1.0 - tolerance);        
float: max_threshold = min(1.0, p0 * (1.0 + tolerance)); 

set of states: non_effect_states = states diff effect_states;

array[states] of var bool: in_AXp;

array[states] of var 0.0..1.0: reach_min;
array[states] of var 0.0..1.0: reach_max;

% 1. Effect state = 1.0
constraint forall(s in effect_states) (
    reach_min[s] = 1.0 /\ reach_max[s] = 1.0
);

% 2. Reach Prob min
constraint
    forall(s in non_effect_states) (
        reach_min[s] = if in_AXp[s] then
            sum(a in actions)(policy[s, a] * sum(s_ in states)(P[s, a, s_] * reach_min[s_]))
        else
            min(a in actions)(sum(s_ in states)(P[s, a, s_] * reach_min[s_]))
        endif
    );

% 2. Reach Prob min
constraint
    forall(s in non_effect_states) (
        reach_max[s] = if in_AXp[s] then
            sum(a in actions)(policy[s, a] * sum(s_ in states)(P[s, a, s_] * reach_max[s_]))
        else
            max(a in actions)(sum(s_ in states)(P[s, a, s_] * reach_max[s_]))
        endif
    );

constraint reach_min[init_state] >= min_threshold;


output [
    "AXp: ", show([s | s in states where fix(in_AXp[s])]), "\n",
    "[", show(reach_min[init_state]), " , ", show(reach_max[init_state]), "]\n"
];