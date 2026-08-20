(() => {
  "use strict";

  const $ = id =>
    document.getElementById(id);

  let initialized = false;
  let plannerDialogHome = null;
  let plannerDialogNext = null;

  function planner() {
    return globalThis.CodexLivingPlanner || null;
  }

  function scheduling() {
    return globalThis.CodexLifeAtlasScheduling || null;
  }

  function patternText() {
    const snapshot =
      globalThis.LivingTimeSphereLiveData
        ?.getSnapshot?.();

    const p = snapshot?.pattern || {};

    if (
      !Number.isFinite(Number(p.moon)) ||
      !Number.isFinite(Number(p.day))
    ) {
      return "Pattern unavailable";
    }

    return [
      `Moon ${p.moon}`,
      `Day ${p.day}`,
      Number.isFinite(Number(p.dayOfPatternYear))
        ? `${p.dayOfPatternYear}/364`
        : null
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function scheduleLabel(record) {
    const schedule =
      scheduling()?.getSchedule?.(record);

    if (!schedule)
      return "Timing unavailable";

    if (schedule.allDay)
      return schedule.startDate || "All day";

    if (schedule.start) {
      try {
        return new Intl.DateTimeFormat(
          undefined,
          {
            dateStyle: "medium",
            timeStyle: "short"
          }
        ).format(
          new Date(schedule.start)
        );
      } catch {
        return schedule.start;
      }
    }

    return "Timing unavailable";
  }

  function setTab(name) {
    document
      .querySelectorAll(
        "[data-living-command-tab]"
      )
      .forEach(button => {
        const active =
          button.dataset.livingCommandTab === name;

        button.setAttribute(
          "aria-selected",
          active ? "true" : "false"
        );
      });

    document
      .querySelectorAll(
        "[data-living-command-view]"
      )
      .forEach(panel => {
        panel.hidden =
          panel.dataset.livingCommandView !== name;
      });

    if (name === "plan")
      movePlannerIntoCommand();

    if (name === "upcoming")
      void renderUpcoming();
  }

  function openCommand(tab = "today") {
    const windowNode =
      $("living-command-window");

    const trigger =
      $("living-command-trigger");

    if (!windowNode)
      return;

    windowNode.hidden = false;
    windowNode.setAttribute(
      "aria-hidden",
      "false"
    );

    trigger?.setAttribute(
      "aria-expanded",
      "true"
    );

    document.body.classList.add(
      "living-command-open"
    );

    refreshContext();
    setTab(tab);
  }

  function closeCommand() {
    const windowNode =
      $("living-command-window");

    if (!windowNode)
      return;

    windowNode.hidden = true;
    windowNode.setAttribute(
      "aria-hidden",
      "true"
    );

    $("living-command-trigger")
      ?.setAttribute(
        "aria-expanded",
        "false"
      );

    document.body.classList.remove(
      "living-command-open"
    );

    restorePlannerDialog();
  }

  function movePlannerIntoCommand() {
    const dialog =
      document.querySelector(
        "#living-planner-modal .living-planner-dialog"
      );

    const host =
      $("living-command-plan-host");

    if (!dialog || !host)
      return;

    if (!plannerDialogHome) {
      plannerDialogHome =
        dialog.parentNode;

      plannerDialogNext =
        dialog.nextSibling;
    }

    host.appendChild(dialog);

    const form =
      $("living-planner-form");

    if (form) {
      const date =
        $("living-planner-date");

      if (
        date &&
        !date.value
      ) {
        const now = new Date();
        const year = now.getFullYear();
        const month =
          String(now.getMonth() + 1)
            .padStart(2, "0");
        const day =
          String(now.getDate())
            .padStart(2, "0");

        date.value =
          `${year}-${month}-${day}`;
      }
    }
  }

  function restorePlannerDialog() {
    const dialog =
      document.querySelector(
        "#living-command-plan-host .living-planner-dialog"
      );

    if (
      !dialog ||
      !plannerDialogHome
    ) {
      return;
    }

    if (
      plannerDialogNext &&
      plannerDialogNext.parentNode === plannerDialogHome
    ) {
      plannerDialogHome.insertBefore(
        dialog,
        plannerDialogNext
      );
    } else {
      plannerDialogHome.appendChild(dialog);
    }
  }

  async function renderUpcoming() {
    const host =
      $("living-command-upcoming");

    const api = planner();

    if (!host || !api)
      return;

    try {
      const records = api.upcomingPlans
        ? await api.upcomingPlans({ years: 2, limit: 64 })
        : await api.allPlans();

      const active =
        records.filter(
          record =>
            !scheduling()
              ?.isCompleted?.(record)
        );

      $("living-command-badge") &&
        ($("living-command-badge").textContent =
          String(active.length));

      if (
        $("living-command-next-plan")
      ) {
        $("living-command-next-plan")
          .textContent =
          active[0]
            ? `Next: ${active[0].title} · ${scheduleLabel(active[0])}`
            : "No upcoming plans.";
      }

      if (!active.length) {
        host.innerHTML =
          '<div class="living-planner-empty">Nothing upcoming.</div>';
        return;
      }

      host.innerHTML =
        active
          .slice(0, 20)
          .map(record => `
            <article
              class="living-command-upcoming-card"
              data-living-plan-id="${record.id}"
            >
              <button
                type="button"
                class="living-command-plan-open"
                data-living-plan-open="${record.id}"
              >
                <small>${record.subtype || "plan"}</small>
                <strong>${record.title || "Untitled plan"}</strong>
                <span>${scheduleLabel(record)}</span>
              </button>

              <button
                type="button"
                class="living-command-plan-edit"
                data-living-plan-edit="${record.id}"
                aria-label="Edit ${record.title || "plan"}"
              >
                Edit
              </button>

              <button
                type="button"
                class="living-command-plan-delete"
                data-living-plan-delete="${record.id}"
                aria-label="Delete ${record.title || "plan"}"
              >
                Delete
              </button>
            </article>
          `)
          .join("");
    } catch (error) {
      console.warn(
        "[LivingCommand] Unable to render upcoming plans.",
        error
      );
    }
  }

  function refreshContext() {
    const text =
      patternText();

    if ($("living-command-coordinate"))
      $("living-command-coordinate")
        .textContent = text;

    if ($("living-command-pattern"))
      $("living-command-pattern")
        .textContent = text;

    void renderUpcoming();
  }

  function openQuestion() {
    closeCommand();

    requestAnimationFrame(() => {
      $("obs-question-ask-now")
        ?.click();
    });
  }

  function showQuestionSettings() {
    closeCommand();

    const details =
      document.querySelector(
        ".obs-question-settings"
      );

    if (!details)
      return;

    details.open = true;
    details.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  function showQuests() {
    closeCommand();

    const details =
      document.querySelector(
        ".obs-quest-builder"
      );

    if (!details)
      return;

    details.open = true;
    details.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  function handleAction(action) {
    if (action === "plan") {
      openCommand("plan");
      return;
    }

    if (action === "question") {
      openQuestion();
      return;
    }

    if (action === "question-settings") {
      showQuestionSettings();
      return;
    }

    if (action === "quests") {
      showQuests();
    }
  }

  function wire() {
    $("living-command-trigger")
      ?.addEventListener(
        "click",
        () => openCommand("today")
      );

    $("living-command-close")
      ?.addEventListener(
        "click",
        closeCommand
      );

    $("living-command-window")
      ?.addEventListener(
        "click",
        event => {
          if (
            event.target ===
            $("living-command-window")
          ) {
            closeCommand();
          }
        }
      );

    document
      .querySelectorAll(
        "[data-living-command-tab]"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () =>
            setTab(
              button.dataset
                .livingCommandTab
            )
        );
      });

    document.addEventListener(
      "click",
      async event => {
        const editButton =
          event.target.closest(
            "[data-living-plan-edit]"
          );

        if (editButton) {
          const id = editButton.dataset.livingPlanEdit;
          if (id) {
            document.dispatchEvent(new CustomEvent("sof:living-plan-selected", {
              detail: { recordId: id, source: "living-command-edit", edit: true }
            }));
          }
          return;
        }

        const deleteButton =
          event.target.closest(
            "[data-living-plan-delete]"
          );

        if (deleteButton) {
          const id =
            deleteButton.dataset
              .livingPlanDelete;

          if (
            id
            && confirm(
              "Delete this planned entry?"
            )
          ) {
            try {
              await planner()
                ?.removePlan?.(id);

              document.dispatchEvent(
                new CustomEvent(
                  "sof:life-atlas-records-changed",
                  {
                    detail: {
                      source:
                        "living-command",
                      action:
                        "delete",
                      id
                    }
                  }
                )
              );

              await renderUpcoming();
            } catch (error) {
              console.warn(
                "[LivingCommand] Unable to delete plan.",
                error
              );
            }
          }

          return;
        }

        const openButton =
          event.target.closest(
            "[data-living-plan-open]"
          );

        if (openButton) {
          const id =
            openButton.dataset
              .livingPlanOpen;

          document.dispatchEvent(
            new CustomEvent(
              "sof:living-plan-selected",
              {
                detail: {
                  recordId: id,
                  source:
                    "living-command",
                  edit: false
                }
              }
            )
          );

          return;
        }

        const action =
          event.target.closest(
            "[data-living-command-action]"
          );

        if (action) {
          handleAction(
            action.dataset
              .livingCommandAction
          );
        }
      }
    );

    document.addEventListener(
      "keydown",
      event => {
        if (
          event.key === "Escape" &&
          !$("living-command-window")?.hidden
        ) {
          closeCommand();
        }
      }
    );

    document.addEventListener(
      "sof:life-atlas-records-changed",
      refreshContext
    );

    /*
     * Sphere record selection bridge.
     * A planner-aware extension dispatches this event when
     * one of its projected plan nodes is selected.
     */
    document.addEventListener(
      "sof:living-plan-selected",
      event => {
        // B7.37 — inspection on the Sphere must stay on the Sphere. Merely
        // selecting a day or scheduled marker must never yank the user into
        // the Upcoming/Schedule tab. Only an explicit agenda request opens it.
        if (event.detail?.openAgenda !== true) return;

        openCommand("upcoming");

        const id = event.detail?.recordId;
        if (!id) return;

        requestAnimationFrame(() => {
          document
            .querySelector(
              `[data-living-plan-id="${CSS.escape(id)}"]`
            )
            ?.scrollIntoView({ block: "center" });
        });
      }
    );
  }

  async function init() {
    if (initialized)
      return;

    initialized = true;

    wire();
    refreshContext();
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }

  globalThis.LivingCommandWindow =
    Object.freeze({
      open:
        openCommand,
      close:
        closeCommand,
      setTab,
      refresh:
        refreshContext
    });
})();
