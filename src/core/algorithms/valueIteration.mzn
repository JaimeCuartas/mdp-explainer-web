enum states;
enum actions;

array[states,actions,states] of float: R;
% Probabilities P(s, a, s')
array[states, actions, states] of float: P;

var float: g;

set of states: effect_states;               % effect
states: init_state;                          % Init
array[states, actions] of float: policy;    % policy pi(a|s)

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

set of states: non_effect_states = states diff effect_states;
array[states] of var 0.0..1.0: reach;

constraint
    forall(s in effect_states) (
        reach[s] = 1.0
    );

constraint
    forall(s in non_effect_states) (
        reach[s] = sum(a in actions) (
            policy[s, a] * sum(s_ in states) (
                P[s, a, s_] * reach[s_]
            )
        )
    );

solve satisfy;

output [
    "--- RESULTADO ---\n",
    "Estado Inicial: ", show(init_state), "\n",
    "Probabilidad de éxito desde el estado inicial: ", show(reach[init_state]), "\n\n",
    "Probabilidad por estado:\n"
] ++ [
    "  " ++ show(s) ++ ": " ++ show(reach[s]) ++ "\n"
    | s in states
];
