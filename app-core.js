(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.FlowMateCore = api;
})(globalThis, function () {
  const SCHEMA_VERSION = 4;

  function normalizeNumber(value) {
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  function createTask(input) {
    const source = input || {};

    return {
      id: String(source.id ?? ''),
      title: String(source.title ?? '').trim(),
      done: Boolean(source.done),
      completedAt: source.completedAt ?? null,
      due: String(source.due ?? ''),
      targetCount: normalizeNumber(source.targetCount),
      icon: String(source.icon ?? ''),
      iconManual: Boolean(source.iconManual),
    };
  }

  function createBlockFromTask(task, goalId, schedule) {
    const sourceTask = task || {};
    const sourceSchedule = schedule || {};

    return Object.assign({}, sourceSchedule, {
      title: String(sourceTask.title ?? '').trim(),
      goalId: String(goalId ?? ''),
      taskId: String(sourceTask.id ?? ''),
      mode: 'none',
      status: 'planned',
      completed: null,
      actualFocusSeconds: 0,
    });
  }

  function recordBlockResult(block, result) {
    const sourceBlock = block || {};
    const sourceResult = result || {};
    const merged = Object.assign({}, sourceBlock);

    ['actualFocusSeconds', 'countAchieved'].forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(sourceResult, key)) {
        merged[key] = normalizeNumber(sourceResult[key]);
      }
    });
    if (Object.prototype.hasOwnProperty.call(sourceResult, 'status')) {
      merged.status = sourceResult.status;
    }
    return merged;
  }

  function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function normalizeMode(goal) {
    if (goal.mode === 'time' || goal.mode === 'count' || goal.mode === 'project') {
      return goal.mode;
    }

    if (goal.mode === 'task') {
      return 'project';
    }

    return Number(goal.targetHours) > 0 ? 'time' : 'project';
  }

  function migrateState(rawState) {
    if (isRecord(rawState) && rawState.schemaVersion === SCHEMA_VERSION) {
      return { state: rawState, migrated: false, removedHabitCount: 0 };
    }

    const source = isRecord(rawState) ? rawState : {};
    const sourceGoals = Array.isArray(source.goals) ? source.goals : [];
    const sourceBlocks = Array.isArray(source.blocks) ? source.blocks : [];
    let removedHabitCount = 0;
    const goals = sourceGoals.reduce(function (migratedGoals, goal) {
      if (!isRecord(goal)) {
        return migratedGoals;
      }

      if (goal.mode === 'habit') {
        removedHabitCount += 1;
        return migratedGoals;
      }

      const rawTasks = goal.tasks || goal.subtasks || [];
      const taskSource = Array.isArray(rawTasks) ? rawTasks : [];
      migratedGoals.push(Object.assign({}, goal, {
        mode: normalizeMode(goal),
        tasks: taskSource.map(createTask),
      }));
      return migratedGoals;
    }, []);
    const blocks = sourceBlocks.filter(isRecord).map(function (block) {
      return Object.assign({}, block, {
        taskId: typeof block.taskId === 'string' ? block.taskId : '',
      });
    });

    return {
      state: {
        schemaVersion: SCHEMA_VERSION,
        goals: goals,
        blocks: blocks,
        timerState: isRecord(source.timerState) ? source.timerState : {},
        prevActiveId: typeof source.prevActiveId === 'string' ? source.prevActiveId : null,
        stats: isRecord(source.stats) && isRecord(source.stats.byDate) ? source.stats : { byDate: {} },
      },
      migrated: true,
      removedHabitCount: removedHabitCount,
    };
  }

  function calculateGoalProgress(goal, tasks, blocks) {
    const sourceGoal = goal || {};
    const mode = sourceGoal.mode;
    const goalBlocks = (blocks || []).filter(function (block) {
      return block && block.goalId === sourceGoal.id;
    });
    const goalTasks = Array.isArray(tasks) ? tasks : [];
    let logged = 0;
    let target = normalizeNumber(sourceGoal.target);
    let unit = '';
    let tasksDone = 0;
    let tasksTotal = 0;

    if (mode === 'project') {
      tasksTotal = goalTasks.length;
      tasksDone = goalTasks.filter(function (task) {
        return task && task.done;
      }).length;
      logged = tasksDone;
      target = tasksTotal;
      unit = 'tasks';
    } else if (mode === 'time') {
      const seconds = goalBlocks.reduce(function (total, block) {
        return total + normalizeNumber(block.actualFocusSeconds);
      }, 0);
      logged = Math.round((seconds / 3600) * 100) / 100;
      unit = 'hours';
    } else if (mode === 'count') {
      logged = goalBlocks.reduce(function (total, block) {
        return total + normalizeNumber(block.countAchieved);
      }, 0);
      unit = String(sourceGoal.unit ?? '');
    }

    return {
      mode: mode,
      pct: target === 0 ? 0 : Math.min(100, Math.round((logged / target) * 100)),
      logged: logged,
      target: target,
      unit: unit,
      tasksDone: tasksDone,
      tasksTotal: tasksTotal,
    };
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    createTask: createTask,
    createBlockFromTask: createBlockFromTask,
    calculateGoalProgress: calculateGoalProgress,
    migrateState: migrateState,
    recordBlockResult: recordBlockResult,
  };
});
