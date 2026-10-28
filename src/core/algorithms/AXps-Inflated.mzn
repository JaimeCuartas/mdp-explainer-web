
enum states;
enum actions;

array[states,actions,states] of float: R;

array[states, actions, states] of float: P;

var float: g;

set of states: effect_states;
states: init_state;
array[states, actions] of float: policy;

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

float: p0 = 0.64;

float: tolerance = 0.14;

% float: min_threshold = p0 * (1.0 - tolerance);
float: min_threshold = max(0.0, p0 - tolerance);
% float: max_threshold = min(1.0, p0 * (1.0 + tolerance));

set of states: non_effect_states = states diff effect_states;
set of states: candidate;

array[states] of set of actions: enabled =
    [ { act | act in actions where sum(t in states)(P[s, act, t]) > 0.0 } | s in states ];


%Similar to S_min=0 / but not completed
set of states: dead_ends = { s | s in non_effect_states where card(enabled[s]) = 0 };

array[states] of var 0.0..1.0: reach_min;

% Effect = 1.0
constraint forall(s in effect_states) (reach_min[s] = 1.0);

constraint forall(s in dead_ends) (reach_min[s] = 0.0);


array[states, states] of float: P_pi =
    array2d(states, states, [ sum(act in actions)(policy[s, act] * P[s, act, t]) | s, t in states ]);

constraint
    forall(s in candidate diff dead_ends, act in enabled[s]) (
        reach_min[s] <=
        sum(t in states)((P_pi[s, t]) * reach_min[t])
    );
    

constraint
    forall(s in non_effect_states diff (candidate union dead_ends), act in enabled[s]) (
        reach_min[s] <= sum(t in states)(P[s, act, t] * reach_min[t])
    );
    
 
array[states] of var 0.0..1.0: lambda;

constraint
    forall(s in candidate diff dead_ends, act in enabled[s]) (
        reach_min[s] <=
        sum(t in states)(
        (lambda[s] * P_pi[s, t] + 
        (1.0 - lambda[s]) * P[s, act, t]) * reach_min[t])
    );
    
    
% constraint
%     forall(s in candidate diff dead_ends, act in enabled[s]) (
%         reach_min[s] <=
%         sum(t in states)(
%         (
%         lambda[s] * P_pi[s, t]   * reach_min[t] + 
%         P[s, act, t] * reach_min[t] - lambda[s] * P[s, act, t] * reach_min[t]
%         )
%         )
%     );

% constraint
%     forall(s in candidate diff dead_ends, act in enabled[s]) (
%         reach_min[s] <=
%         sum(t in states)(
%         ( 
%         P[s, act, t] * reach_min[t] +
%         (P_pi[s,t] - P[s, act, t]) * lambda[s] * reach_min[t]
%         )
%         )
%     );

constraint
    forall(s in candidate diff dead_ends, act in enabled[s]) (
        reach_min[s] <=
        sum(t in states)(
        ( 
        P[s, act, t] * reach_min[t] +
        (P_pi[s,t] - P[s, act, t]) * lambda[s] * reach_min[t]
        )
    ));

constraint reach_min[init_state] >= min_threshold;


%solve maximize sum(s in states)(reach_min[s]);
solve minimize sum(s in states)(lambda[s]);

output [
    "States: ",
    show([s | s in states]), "\n",
    "AXp: ",
    show([s | s in candidate]), "\n",
    "[", show(reach_min[init_state]), "\n",
    show([reach_min[s] | s in states]), "\n",
    show([lambda[s] | s in states]), "\n",
%     " , ",
%     show(reach_max[init_state]),
    "]\n"
];