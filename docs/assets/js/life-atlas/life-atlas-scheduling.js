/**
 * Codex Life Atlas
 * Scheduling Foundation
 *
 * Canonical scheduling metadata for calendar events, tasks,
 * appointments, reminders, deadlines, milestones and availability.
 *
 * Scheduling is projection-independent and does not own temporal truth.
 */
(function (root, factory) {
  let Schema = root.CodexLifeAtlasSchema;

  if (typeof module === "object" && module.exports) {
    Schema = require("./life-atlas-schema.js");
    module.exports = factory(Schema);
    return;
  }

  root.CodexLifeAtlasScheduling =
    factory(Schema);
})(
  typeof globalThis !== "undefined"
    ? globalThis
    : this,
  function (Schema) {
    "use strict";

    if (!Schema) {
      throw new Error(
        "CodexLifeAtlasSchema is required."
      );
    }

    const VERSION = "1.0.0";

    const SCHEDULE_KINDS =
      Object.freeze([
        "event",
        "appointment",
        "task",
        "reminder",
        "deadline",
        "milestone",
        "availability",
        "travel",
        "release",
        "practice"
      ]);

    const STATUS =
      Object.freeze([
        "planned",
        "tentative",
        "confirmed",
        "in-progress",
        "completed",
        "cancelled"
      ]);

    const PRIORITY =
      Object.freeze([
        "low",
        "normal",
        "high",
        "critical"
      ]);

    const RECURRENCE_FREQUENCIES =
      Object.freeze([
        "none",
        "daily",
        "weekly",
        "monthly",
        "yearly",
        "custom"
      ]);

    const WEEKDAYS =
      Object.freeze([
        "MO",
        "TU",
        "WE",
        "TH",
        "FR",
        "SA",
        "SU"
      ]);

    const REMINDER_METHODS =
      Object.freeze([
        "notification",
        "visual",
        "sound",
        "email",
        "external"
      ]);

    function clone(value) {
      return value == null
        ? value
        : JSON.parse(
            JSON.stringify(value)
          );
    }

    function cleanString(
      value,
      fallback = ""
    ) {
      if (
        value === undefined ||
        value === null
      ) {
        return fallback;
      }

      return String(value).trim();
    }

    function nullableIso(value) {
      const text =
        cleanString(value);

      if (!text) {
        return null;
      }

      const time =
        Date.parse(text);

      return Number.isFinite(time)
        ? new Date(time).toISOString()
        : null;
    }

    function nullableDate(value) {
      const text =
        cleanString(value);

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
          text
        )
      ) {
        return null;
      }

      return text;
    }

    function positiveInteger(
      value,
      fallback = 1
    ) {
      const number =
        Number(value);

      return (
        Number.isInteger(number) &&
        number > 0
      )
        ? number
        : fallback;
    }

    function uniqueStrings(values) {
      if (!Array.isArray(values)) {
        return [];
      }

      return [
        ...new Set(
          values
            .map(value =>
              cleanString(value)
            )
            .filter(Boolean)
        )
      ];
    }

    function normalizeAttendee(
      input = {}
    ) {
      const source =
        input &&
        typeof input === "object"
          ? input
          : {};

      return {
        id:
          cleanString(
            source.id
          ) || null,

        name:
          cleanString(
            source.name
          ) || "",

        email:
          cleanString(
            source.email
          ) || null,

        role:
          cleanString(
            source.role,
            "attendee"
          ),

        response:
          cleanString(
            source.response,
            "needs-action"
          )
      };
    }

    function normalizeReminder(
      input = {}
    ) {
      const source =
        input &&
        typeof input === "object"
          ? input
          : {};

      const offsetMinutes =
        Number(
          source.offsetMinutes
        );

      return {
        id:
          cleanString(
            source.id
          ) || null,

        offsetMinutes:
          Number.isFinite(
            offsetMinutes
          )
            ? Math.trunc(
                offsetMinutes
              )
            : 0,

        method:
          REMINDER_METHODS.includes(
            source.method
          )
            ? source.method
            : "notification",

        enabled:
          source.enabled !== false,

        label:
          cleanString(
            source.label
          ) || null
      };
    }

    function normalizeRecurrence(
      input = {}
    ) {
      const source =
        input &&
        typeof input === "object"
          ? input
          : {};

      const frequency =
        RECURRENCE_FREQUENCIES.includes(
          source.frequency
        )
          ? source.frequency
          : "none";

      const byWeekday =
        uniqueStrings(
          source.byWeekday
        ).filter(value =>
          WEEKDAYS.includes(value)
        );

      return {
        frequency,

        interval:
          positiveInteger(
            source.interval,
            1
          ),

        byWeekday,

        byMonthDay:
          Array.isArray(
            source.byMonthDay
          )
            ? [
                ...new Set(
                  source.byMonthDay
                    .map(Number)
                    .filter(value =>
                      Number.isInteger(
                        value
                      ) &&
                      value >= 1 &&
                      value <= 31
                    )
                )
              ]
            : [],

        count:
          Number.isInteger(
            Number(source.count)
          ) &&
          Number(source.count) > 0
            ? Number(source.count)
            : null,

        until:
          nullableIso(
            source.until
          ),

        rawRRule:
          cleanString(
            source.rawRRule
          ) || null
      };
    }

    function normalizeSchedule(
      input = {}
    ) {
      const source =
        input &&
        typeof input === "object"
          ? input
          : {};

      const allDay =
        source.allDay === true;

      const kind =
        SCHEDULE_KINDS.includes(
          source.kind
        )
          ? source.kind
          : "event";

      const schedule = {
        version: VERSION,

        kind,

        status:
          STATUS.includes(
            source.status
          )
            ? source.status
            : "planned",

        priority:
          PRIORITY.includes(
            source.priority
          )
            ? source.priority
            : "normal",

        allDay,

        timezone:
          cleanString(
            source.timezone
          ) || null,

        start:
          allDay
            ? null
            : nullableIso(
                source.start
              ),

        end:
          allDay
            ? null
            : nullableIso(
                source.end
              ),

        startDate:
          allDay
            ? nullableDate(
                source.startDate ||
                source.date
              )
            : null,

        endDate:
          allDay
            ? nullableDate(
                source.endDate ||
                source.startDate ||
                source.date
              )
            : null,

        durationMinutes:
          Number.isFinite(
            Number(
              source.durationMinutes
            )
          )
            ? Math.max(
                0,
                Math.trunc(
                  Number(
                    source.durationMinutes
                  )
                )
              )
            : null,

        recurrence:
          normalizeRecurrence(
            source.recurrence
          ),

        reminders:
          Array.isArray(
            source.reminders
          )
            ? source.reminders
                .map(
                  normalizeReminder
                )
            : [],

        attendees:
          Array.isArray(
            source.attendees
          )
            ? source.attendees
                .map(
                  normalizeAttendee
                )
            : [],

        availability:
          cleanString(
            source.availability,
            "busy"
          ),

        locationId:
          cleanString(
            source.locationId
          ) || null,

        locationLabel:
          cleanString(
            source.locationLabel
          ) || null,

        completedAt:
          nullableIso(
            source.completedAt
          ),

        external: {
          provider:
            cleanString(
              source.external
                ?.provider
            ) || null,

          calendarId:
            cleanString(
              source.external
                ?.calendarId
            ) || null,

          eventId:
            cleanString(
              source.external
                ?.eventId
            ) || null,

          syncToken:
            cleanString(
              source.external
                ?.syncToken
            ) || null
        }
      };

      return schedule;
    }

    function validateSchedule(
      schedule
    ) {
      const errors = [];

      if (
        !schedule ||
        typeof schedule !== "object"
      ) {
        return {
          valid: false,
          errors: [
            "Schedule must be an object."
          ]
        };
      }

      if (
        !SCHEDULE_KINDS.includes(
          schedule.kind
        )
      ) {
        errors.push(
          "Unknown schedule kind."
        );
      }

      if (
        schedule.allDay
      ) {
        if (!schedule.startDate) {
          errors.push(
            "All-day schedules require startDate."
          );
        }
      } else if (!schedule.start) {
        errors.push(
          "Timed schedules require start."
        );
      }

      if (
        schedule.start &&
        schedule.end &&
        Date.parse(
          schedule.end
        ) <
          Date.parse(
            schedule.start
          )
      ) {
        errors.push(
          "Schedule end cannot precede start."
        );
      }

      return {
        valid:
          errors.length === 0,
        errors
      };
    }

    function createSchedule(
      input = {}
    ) {
      const schedule =
        normalizeSchedule(input);

      const validation =
        validateSchedule(
          schedule
        );

      if (!validation.valid) {
        const error =
          new Error(
            `Invalid Life Atlas schedule: ${validation.errors.join(" ")}`
          );

        error.validation =
          validation;

        throw error;
      }

      return schedule;
    }

    function attachSchedule(
      recordInput,
      scheduleInput
    ) {
      const schedule =
        createSchedule(
          scheduleInput
        );

      const source =
        clone(
          recordInput || {}
        );

      source.payload = {
        ...(
          source.payload ||
          {}
        ),

        schedule
      };

      if (
        !source.subtype
      ) {
        source.subtype =
          schedule.kind;
      }

      if (
        !source.temporal
      ) {
        source.temporal = {};
      }

      if (
        schedule.allDay
      ) {
        if (
          !source.temporal
            .civilDate
        ) {
          source.temporal
            .civilDate =
            schedule.startDate;
        }
      } else {
        if (
          !source.temporal
            .start
        ) {
          source.temporal.start =
            schedule.start;
        }

        if (
          !source.temporal
            .end &&
          schedule.end
        ) {
          source.temporal.end =
            schedule.end;
        }

        if (
          !source.temporal
            .instant
        ) {
          source.temporal.instant =
            schedule.start;
        }
      }

      return Schema.createLifeRecord(
        source
      );
    }

    function getSchedule(
      record
    ) {
      const schedule =
        record?.payload
          ?.schedule;

      if (!schedule) {
        return null;
      }

      try {
        return createSchedule(
          schedule
        );
      } catch {
        return null;
      }
    }

    function isScheduled(
      record
    ) {
      return Boolean(
        getSchedule(record)
      );
    }

    function isCompleted(
      record
    ) {
      const schedule =
        getSchedule(record);

      if (!schedule) {
        return false;
      }

      return (
        schedule.status ===
          "completed" ||
        Boolean(
          schedule.completedAt
        )
      );
    }

    return Object.freeze({
      VERSION,

      SCHEDULE_KINDS,
      STATUS,
      PRIORITY,
      RECURRENCE_FREQUENCIES,
      WEEKDAYS,
      REMINDER_METHODS,

      normalizeAttendee,
      normalizeReminder,
      normalizeRecurrence,
      normalizeSchedule,

      validateSchedule,
      createSchedule,

      attachSchedule,
      getSchedule,
      isScheduled,
      isCompleted
    });
  }
);
