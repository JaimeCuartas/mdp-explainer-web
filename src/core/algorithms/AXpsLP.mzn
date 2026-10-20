% Linear-programming check of a candidate explanation X, the MiniZinc version
% of reachabilityLP.ts (what the tool solves with HiGHS).
%
% AXps.mzn made in_AXp a decision variable and wrote the reachability as
% equalities with min/max, which is not linear and admits wrong fixed points.
% Here X is data, so every constraint is linear:
%
%   reach_max:  minimise sum(reach_max)  s.t.  reach_max[s] >= sum_t P[s,a,t] * reach_max[t]
%               (the least such vector is Pr^max; no precomputation needed)
%   reach_min:  maximise sum(reach_min)  s.t.  reach_min[s] <= sum_t P[s,a,t] * reach_min[t]
%               (the greatest such vector is Pr^min, but only once the states
%               that can avoid the effect forever, S0 below, are fixed to 0)
%
% A state in X has the single constraint with the policy mixture P_pi instead
% of one constraint per action. The two blocks share no variables, so one
% objective, sum(reach_min) - sum(reach_max), solves both at once.
%
% Loop variables are named act, not a, because exported models often have an
% action called a.
%
% Run with an LP/MIP solver, for example:
%   minizinc --solver highs AXpsLP.mzn smallmdp.dzn \
%     -D "X = {s_kee72v9, s_89ds41w}; p0 = 0.8; bound = MinOnly;"
%
% p0 is computed by this same model: run it with X = non_effect_states (every
% state follows the policy), where reach_min and reach_max at init_state both
% equal p0.

enum states;
enum actions;

% Present in the .dzn files the tool exports; not used here.
array[states, actions, states] of float: R;
float: g;

array[states, actions, states] of float: P;

set of states: effect_states;
states: init_state;
array[states, actions] of float: policy;

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% Candidate explanation: the states that follow the policy.
set of states: X;

float: p0;

float: tolerance = 0.60;

float: min_threshold = p0 * (1.0 - tolerance);
float: max_threshold = min(1.0, p0 * (1.0 + tolerance));

% Which side isAXp checks, like the tool's "AXp check" toggle.
enum Bound = { MinOnly, MaxOnly, Both };
Bound: bound;

% Same slack as THRESHOLD_SLACK in explain.ts.
float: slack = 1e-5;

set of states: non_effect_states = states diff effect_states;

% Actions enabled in s: the ones with outgoing probability.
array[states] of set of actions: enabled =
    [ { act | act in actions where sum(t in states)(P[s, act, t]) > 0.0 } | s in states ];

% One-step probability from s to t when the action is chosen by the policy.
array[states, states] of float: P_pi =
    array2d(states, states, [ sum(act in actions)(policy[s, act] * P[s, act, t]) | s, t in states ]);

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% S0: states whose min reachability is 0. T is the least set containing the
% effect states and every state that is forced to move into T with positive
% probability: a state of X if its policy mixture can reach T, a free state if
% it has actions and every one of them can reach T. Computed on the data, so it
% adds nothing non-linear to the model.

function set of states: forced_closure(set of states: T) =
    let {
        set of states: grown = T union {
            s | s in non_effect_states where
                if s in X then
                    exists(t in T)(P_pi[s, t] > 0.0)
                else
                    card(enabled[s]) > 0 /\
                    forall(act in enabled[s])(exists(t in T)(P[s, act, t] > 0.0))
                endif
        };
    } in
    if grown = T then T else forced_closure(grown) endif;

set of states: S0 = states diff forced_closure(effect_states);

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

array[states] of var 0.0..1.0: reach_min;
array[states] of var 0.0..1.0: reach_max;

% 1. Effect state = 1.0
constraint forall(s in effect_states) (
    reach_min[s] = 1.0 /\ reach_max[s] = 1.0
);

% 2. Reach Prob max: one ">=" per choice; the minimisation picks Pr^max.
constraint
    forall(s in non_effect_states) (
        if s in X then
            reach_max[s] >= sum(t in states)(P_pi[s, t] * reach_max[t])
        else
            forall(act in enabled[s])(
                reach_max[s] >= sum(t in states)(P[s, act, t] * reach_max[t])
            )
        endif
    );

% 3. Reach Prob min: S0 fixed to 0, one "<=" per choice elsewhere; the
%    maximisation picks Pr^min.
constraint forall(s in S0) (reach_min[s] = 0.0);

constraint
    forall(s in non_effect_states diff S0) (
        if s in X then
            reach_min[s] <= sum(t in states)(P_pi[s, t] * reach_min[t])
        else
            forall(act in enabled[s])(
                reach_min[s] <= sum(t in states)(P[s, act, t] * reach_min[t])
            )
        endif
    );

solve maximize sum(s in states)(reach_min[s]) - sum(s in states)(reach_max[s]);

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% The verdict compares the optimal values with the thresholds after solving,
% like isAXp does. (Posting them as constraints instead would also be correct:
% the feasible reach_min vectors are exactly those <= Pr^min, so
% reach_min[init_state] >= min_threshold is feasible iff Pr^min >= min_threshold,
% and symmetrically for reach_max; UNSATISFIABLE would then mean "not an AXp".)

output [
    let {
        float: pmin = fix(reach_min[init_state]);
        float: pmax = fix(reach_max[init_state]);
        bool: lower_ok = bound = MaxOnly \/ pmin >= min_threshold - slack;
        bool: upper_ok = bound = MinOnly \/ pmax <= max_threshold + slack;
    } in
    "X: " ++ show(X) ++ "\n" ++
    "S0 (min reachability 0): " ++ show(S0) ++ "\n" ++
    "[Pr^min, Pr^max] at init: [" ++ show(pmin) ++ " , " ++ show(pmax) ++ "]\n" ++
    "allowed range: [" ++ show(min_threshold) ++ " , " ++ show(max_threshold) ++ "]\n" ++
    "weak AXp (" ++ show(bound) ++ "): " ++ show(lower_ok /\ upper_ok) ++ "\n"
];
