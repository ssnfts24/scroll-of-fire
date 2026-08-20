(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  let initialized = false;
  let returnFocus = null;
  let editingPlanId = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function localDateString(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function planner() {
    return globalThis.CodexLivingPlanner || null;
  }

  function scheduling() {
    return globalThis.CodexLifeAtlasScheduling || null;
  }

  function livePatternText() {
    const snap =
      globalThis.LivingTimeSphereLiveData?.getSnapshot?.();

    const p = snap?.pattern || {};

    if (
      !Number.isFinite(Number(p.moon)) ||
      !Number.isFinite(Number(p.day))
    ) {
      return "Pattern context unavailable";
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

  function setPatternReadouts() {
    const value = livePatternText();

    if ($("living-planner-context"))
      $("living-planner-context").textContent = value;

    if ($("living-planner-pattern-readout"))
      $("living-planner-pattern-readout").textContent = value;
  }

  function setTimeEnabled() {
    const allDay = $("living-planner-all-day");
    const time = $("living-planner-time");

    if (!allDay || !time) return;

    time.disabled = allDay.checked;

    if (allDay.checked)
      time.value = "";
  }

  function openPlanner(options = {}) {
    const modal = $("living-planner-modal");
    const form = $("living-planner-form");

    if (!modal || !form) return;

    returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    form.reset();
    editingPlanId = options.editingPlanId || null;
    form.dataset.editingPlanId = editingPlanId || "";

    const dialogTitle = $("living-planner-dialog-title");
    const submitButton = form.querySelector('[type="submit"]');
    if (dialogTitle) dialogTitle.textContent = editingPlanId ? "Edit Living Plan" : "Plan in Living Time";
    if (submitButton) submitButton.textContent = editingPlanId ? "Save changes" : "Save plan";

    const date = $("living-planner-date");
    const allDay = $("living-planner-all-day");

    if (date)
      date.value = localDateString();

    if (allDay)
      allDay.checked = true;

    setTimeEnabled();
    setPatternReadouts();

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("living-planner-modal-open");

    requestAnimationFrame(() => {
      $("living-planner-title-input")?.focus({
        preventScroll: true
      });
    });
  }

  async function openPlannerForRecord(recordId) {
    const api = planner();
    if (!api || !recordId) return;
    const record = api.getPlan
      ? await api.getPlan(recordId)
      : (await api.allPlans?.() || []).find(item => item?.id === recordId);
    if (!record) return;

    openPlanner({ editingPlanId: recordId });
    const form = $("living-planner-form");
    const schedule = scheduling()?.getSchedule?.(record) || null;
    if (!form) return;

    const set = (name, value) => {
      const field = form.elements.namedItem(name);
      if (field && value != null) field.value = String(value);
    };

    set("title", record.title || "");
    set("category", record.subtype || record.payload?.planner?.category || "event");
    set("symbol", record.payload?.planner?.symbol || "auto");
    set("priority", schedule?.priority || "normal");
    set("date", schedule?.startDate || schedule?.start?.slice?.(0, 10) || "");
    set("time", schedule?.allDay ? "" : (schedule?.start ? new Date(schedule.start).toTimeString().slice(0, 5) : ""));
    const allDay = $("living-planner-all-day");
    if (allDay) allDay.checked = schedule?.allDay !== false;
    set("frequency", schedule?.recurrence?.frequency || "none");
    set("interval", schedule?.recurrence?.interval || 1);
    set("reminderMinutes", schedule?.reminders?.[0]?.offsetMinutes != null ? Math.abs(Number(schedule.reminders[0].offsetMinutes)) : "");
    set("location", schedule?.locationLabel || record.spatial?.placeId || "");
    set("notes", record.summary || "");
    set("intention", record.payload?.planner?.intention || "");
    set("seasonalWindow", record.payload?.planner?.seasonalWindow || "");
    setTimeEnabled();
    $("living-planner-title-input")?.focus?.({ preventScroll: true });
  }

  function closePlanner() {
    const modal = $("living-planner-modal");

    if (!modal) return;

    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    editingPlanId = null;
    $("living-planner-form")?.removeAttribute?.("data-editing-plan-id");
    document.body.classList.remove("living-planner-modal-open");

    if (
      returnFocus &&
      document.contains(returnFocus)
    ) {
      returnFocus.focus?.({
        preventScroll: true
      });
    }

    returnFocus = null;
  }

  function formatSchedule(record) {
    const schedule =
      scheduling()?.getSchedule?.(record);

    if (!schedule)
      return "Unscheduled";

    const repeat =
      schedule.recurrence?.frequency &&
      schedule.recurrence.frequency !== "none"
        ? ` · ${schedule.recurrence.frequency}`
        : "";

    if (schedule.allDay) {
      return `${schedule.startDate || "Date unavailable"}${repeat}`;
    }

    if (schedule.start) {
      try {
        return `${new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short"
        }).format(new Date(schedule.start))}${repeat}`;
      } catch {
        return `${schedule.start}${repeat}`;
      }
    }

    return "Timing unavailable";
  }

  function isComplete(record) {
    return Boolean(
      scheduling()?.isCompleted?.(record)
    );
  }

  function renderCard(record) {
    const complete = isComplete(record);

    return `
      <article
        class="living-plan-card"
        data-plan-id="${escapeHtml(record.id)}"
        ${complete ? 'data-plan-complete="true"' : ""}
      >
        <div>
          <small>
            ${escapeHtml(record.subtype || "plan")}
            ${complete ? " · completed" : ""}
          </small>

          <h3>${escapeHtml(record.title || "Untitled plan")}</h3>

          <p>${escapeHtml(formatSchedule(record))}</p>

          ${
            record.summary
              ? `<p>${escapeHtml(record.summary)}</p>`
              : ""
          }
        </div>

        <div class="living-plan-card__actions">
          <button
            class="sphere-btn"
            type="button"
            data-plan-action="edit"
          >
            Edit
          </button>
          ${
            complete
              ? ""
              : `
                <button
                  class="sphere-btn"
                  type="button"
                  data-plan-action="complete"
                >
                  Complete
                </button>
              `
          }

          <button
            class="sphere-btn"
            type="button"
            data-plan-action="delete"
          >
            Delete
          </button>
        </div>
      </article>
    `;
  }

  async function renderPlans() {
    const host = $("living-planner-list");
    const api = planner();

    if (!host || !api)
      return;

    try {
      const plans = api.upcomingPlans
        ? await api.upcomingPlans({ years: 2, limit: 48 })
        : await api.allPlans();

      const active =
        plans.filter(record => !isComplete(record));

      if ($("living-planner-upcoming-count"))
        $("living-planner-upcoming-count").textContent =
          String(active.length);

      if ($("living-planner-next"))
        $("living-planner-next").textContent =
          active[0]
            ? active[0].title || "Untitled plan"
            : "Nothing planned yet";

      if (!plans.length) {
        host.innerHTML = `
          <div class="living-planner-empty">
            Nothing is planned yet.
            Add a task, event, growing window,
            seasonal practice, project, or reminder.
          </div>
        `;
        return;
      }

      host.innerHTML =
        plans
          .slice(0, 12)
          .map(renderCard)
          .join("");
    } catch (error) {
      console.error("[LivingPlannerUI] render failed", error);

      host.innerHTML = `
        <div class="living-planner-empty">
          Planner records could not be read.
        </div>
      `;
    }
  }

  function formPayload(form) {
    const data = new FormData(form);

    return {
      title:
        data.get("title"),

      category:
        data.get("category"),

      symbol:
        data.get("symbol"),

      priority:
        data.get("priority"),

      date:
        data.get("date"),

      time:
        data.get("time"),

      allDay:
        Boolean(data.get("allDay")),

      recurrence: {
        frequency:
          data.get("frequency"),

        interval:
          data.get("interval"),

        until:
          data.get("until")
            ? new Date(
                `${data.get("until")}T23:59:59`
              ).toISOString()
            : null,

        count:
          data.get("count")
      },

      reminderMinutes:
        data.get("reminderMinutes") || null,

      location:
        data.get("location"),

      notes:
        data.get("notes"),

      intention:
        data.get("intention"),

      tags:
        data.get("tags"),

      seasonalWindow:
        data.get("seasonalWindow")
    };
  }

  async function submitPlan(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const api = planner();

    if (!api)
      return;

    if (!form.reportValidity())
      return;

    const submit =
      form.querySelector('[type="submit"]');

    if (submit)
      submit.disabled = true;

    try {
      const payload = formPayload(form);
      const wasEditing = Boolean(editingPlanId);
      const changedId = editingPlanId || null;

      if (wasEditing && api.updatePlan) {
        await api.updatePlan(editingPlanId, payload);
      } else {
        await api.createPlan(payload);
      }

      closePlanner();
      await renderPlans();

      document.dispatchEvent(
        new CustomEvent(
          "sof:life-atlas-records-changed",
          {
            detail: {
              source: "living-planner",
              action: wasEditing ? "update" : "create",
              id: changedId
            }
          }
        )
      );
    } catch (error) {
      console.error(
        "[LivingPlannerUI] save failed",
        error
      );

      alert(
        `Plan could not be saved: ${
          error?.message || error
        }`
      );
    } finally {
      if (submit)
        submit.disabled = false;
    }
  }

  async function handlePlanAction(event) {
    const button =
      event.target.closest(
        "button[data-plan-action]"
      );

    const card =
      event.target.closest(
        "[data-plan-id]"
      );

    if (!button || !card)
      return;

    const id =
      card.dataset.planId;

    const action =
      button.dataset.planAction;

    const api = planner();

    if (!api || !id)
      return;

    try {
      if (action === "edit") {
        await openPlannerForRecord(id);
        return;
      }

      if (action === "complete")
        await api.completePlan(id);

      if (
        action === "delete" &&
        confirm("Delete this plan?")
      ) {
        await api.removePlan(id);
      } else if (action === "delete") {
        return;
      }

      await renderPlans();

      document.dispatchEvent(
        new CustomEvent(
          "sof:life-atlas-records-changed",
          {
            detail: {
              source: "living-planner",
              action,
              id
            }
          }
        )
      );
    } catch (error) {
      console.error(
        "[LivingPlannerUI] plan action failed",
        error
      );
    }
  }

  function wire() {
    $("living-planner-open")
      ?.addEventListener(
        "click",
        openPlanner
      );

    $("living-planner-close")
      ?.addEventListener(
        "click",
        closePlanner
      );

    $("living-planner-cancel")
      ?.addEventListener(
        "click",
        closePlanner
      );

    $("living-planner-all-day")
      ?.addEventListener(
        "change",
        setTimeEnabled
      );

    $("living-planner-form")
      ?.addEventListener(
        "submit",
        submitPlan
      );

    document.addEventListener("sof:living-plan-selected", event => {
      const id = event.detail?.recordId;
      // B7.33: selection is inspection/navigation only. The editor opens only
      // when an explicit Edit control dispatches edit:true.
      if (!id || event.detail?.edit !== true) return;
      void openPlannerForRecord(id);
    });

    $("living-planner-list")
      ?.addEventListener(
        "click",
        handlePlanAction
      );

    $("living-planner-modal")
      ?.addEventListener(
        "click",
        event => {
          if (
            event.target ===
            $("living-planner-modal")
          ) {
            closePlanner();
          }
        }
      );

    document.addEventListener(
      "keydown",
      event => {
        if (
          event.key === "Escape" &&
          !$("living-planner-modal")?.hidden
        ) {
          closePlanner();
        }
      }
    );

    document.addEventListener(
      "sof:life-atlas-records-changed",
      event => {
        if (
          event.detail?.source !==
          "living-planner"
        ) {
          renderPlans();
        }
      }
    );
  }

  async function init() {
    if (initialized)
      return;

    const api = planner();

    if (!api?.init?.()) {
      console.warn(
        "[LivingPlannerUI] Planner engine unavailable."
      );
      return;
    }

    initialized = true;

    wire();
    setPatternReadouts();
    await renderPlans();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }
})();
