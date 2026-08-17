(function (root, factory) {
  const api = factory(
    root.CodexLifeAtlasWorldModel,
    root.CodexLifeAtlasWorldBuilder,
    root.CodexLifeAtlasWorldNavigation,
    root.CodexLifeAtlasRenderProjection
  );

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.CodexLifeAtlasSphereWorldExtension = api;

  /*
   * Register with the isolated Sphere extension host when running
   * in the browser. Registration remains optional so the module can
   * still be imported independently by tests and tooling.
   */
  if (
    root.LivingTimeSphereExtensionHost &&
    typeof root.LivingTimeSphereExtensionHost.register === "function"
  ) {
    root.LivingTimeSphereExtensionHost.register(api);
  }
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function (
    WorldModel,
    WorldBuilder,
    WorldNavigation,
    RenderProjection
  ) {
    "use strict";

    const VERSION = "1.0.0";
    const EXTENSION_ID = "life-atlas-temporal-world";

    const state = {
      mounted: false,
      enabled: true,
      scene: null,
      camera: null,
      THREE: null,
      rootGroup: null,
      yearGroup: null,
      connectionGroup: null,
      activeYear: null,
      builder: null,
      navigation: null,
      projection: null,
      lastContext: null,
      revision: 0
    };

    function safeNumber(value, fallback = 0) {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }

    function clearGroup(group) {
      if (!group?.children) return;

      while (group.children.length) {
        const child = group.children.pop();

        try {
          child.geometry?.dispose?.();
        } catch (_) {}

        try {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material?.dispose?.());
          } else {
            child.material?.dispose?.();
          }
        } catch (_) {}
      }
    }

    function buildYearMesh(node, projected, selectedYear) {
      const THREE = state.THREE;

      const scale = Math.max(
        0.025,
        safeNumber(projected?.scale, 0.07)
      );

      const geometry =
        new THREE.IcosahedronGeometry(scale, 1);

      const isSelected =
        Number(node?.temporal?.year ?? node?.year) ===
        Number(selectedYear);

      const material =
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: isSelected ? 0.92 : 0.38,
          depthWrite: false
        });

      const mesh =
        new THREE.Mesh(
          geometry,
          material
        );

      const position =
        projected?.position ||
        node?.position ||
        { x: 0, y: 0, z: 0 };

      mesh.position.set(
        safeNumber(position.x),
        safeNumber(position.y),
        safeNumber(position.z)
      );

      if (isSelected) {
        mesh.scale.setScalar(1.45);
      }

      mesh.userData = {
        extension: EXTENSION_ID,
        type: "life-atlas-world",
        level: node?.level || "year",
        nodeId: node?.id || null,
        year:
          node?.temporal?.year ??
          node?.year ??
          null,
        interactionTarget:
          projected?.interactionTarget ||
          node?.id ||
          null
      };

      return mesh;
    }

    function buildConnection(connection) {
      const THREE = state.THREE;

      const from =
        connection?.from ||
        connection?.source ||
        connection?.start;

      const to =
        connection?.to ||
        connection?.target ||
        connection?.end;

      if (!from || !to) return null;

      const points = [
        new THREE.Vector3(
          safeNumber(from.x),
          safeNumber(from.y),
          safeNumber(from.z)
        ),
        new THREE.Vector3(
          safeNumber(to.x),
          safeNumber(to.y),
          safeNumber(to.z)
        )
      ];

      const geometry =
        new THREE.BufferGeometry()
          .setFromPoints(points);

      const material =
        new THREE.LineBasicMaterial({
          transparent: true,
          opacity: connection?.dashed ? 0.18 : 0.12,
          depthWrite: false
        });

      const line =
        new THREE.Line(
          geometry,
          material
        );

      line.userData = {
        extension: EXTENSION_ID,
        type: "life-atlas-connection",
        relationType:
          connection?.type ||
          null
      };

      return line;
    }

    function resolveYears(context = {}) {
      const selectedYear =
        Number(
          context.selectedYear ??
          context.model?.year ??
          new Date().getFullYear()
        );

      const spiralYears =
        Array.isArray(context.spiral?.years)
          ? context.spiral.years
              .map(item => Number(item?.year))
              .filter(Number.isFinite)
          : [];

      if (spiralYears.length) {
        return {
          selectedYear,
          years: spiralYears
        };
      }

      const years = [];

      for (
        let year = selectedYear - 6;
        year <= selectedYear + 6;
        year += 1
      ) {
        years.push(year);
      }

      return {
        selectedYear,
        years
      };
    }

    function buildFallbackYearNodes(years, selectedYear) {
      const count = Math.max(1, years.length);

      return years.map((year, index) => {
        const offset =
          index - (count - 1) / 2;

        const angle =
          index * 0.82;

        const radius =
          1.65 +
          Math.abs(offset) * 0.13;

        return {
          id: `life-atlas-year:${year}`,
          level: "year",

          temporal: {
            year
          },

          position: {
            x:
              Math.cos(angle) *
              radius,

            y:
              offset * 0.28,

            z:
              Math.sin(angle) *
              radius
          },

          selected:
            year === selectedYear
        };
      });
    }

    function temporalYear(node) {
      return Number(
        node?.temporal?.patternYear ??
        node?.temporal?.year ??
        node?.year
      );
    }

    function temporalMoon(node) {
      return Number(
        node?.temporal?.moon
      );
    }

    function temporalDay(node) {
      return Number(
        node?.temporal?.moonDay ??
        node?.temporal?.day
      );
    }

    function normalizeFocusLevel(level) {
      return WorldModel?.LEVELS?.includes(level)
        ? level
        : "year";
    }

    function resolveSelectedTemporal(context = {}) {
      const selected =
        context.model?.selectedPatternPosition ||
        context.model?.todayPatternPosition ||
        context.selected ||
        {};

      const selectedYear =
        Number(
          context.selectedYear ??
          selected.patternYear ??
          context.model?.year ??
          new Date().getFullYear()
        );

      const selectedMoon =
        Number(
          selected.moon ??
          selected.moonNumber ??
          1
        );

      const selectedDay =
        Number(
          selected.moonDay ??
          selected.day ??
          1
        );

      const selectedHour =
        Number(
          selected.hour ??
          new Date().getHours()
        );

      return {
        selectedYear:
          Number.isFinite(selectedYear)
            ? selectedYear
            : new Date().getFullYear(),

        selectedMoon:
          Number.isFinite(selectedMoon)
            ? Math.min(13, Math.max(1, selectedMoon))
            : 1,

        selectedDay:
          Number.isFinite(selectedDay)
            ? Math.min(28, Math.max(1, selectedDay))
            : 1,

        selectedHour:
          Number.isFinite(selectedHour)
            ? Math.min(23, Math.max(0, selectedHour))
            : 0
      };
    }

    function initialFocusNode(context = {}) {
      const temporal =
        resolveSelectedTemporal(context);

      const years =
        resolveYears(context).years;

      let nodes =
        WorldModel?.buildYearField?.({
          years,
          anchorYear:
            temporal.selectedYear
        }) || [];

      let yearNode =
        nodes.find(
          node =>
            temporalYear(node) ===
            temporal.selectedYear
        );

      if (!yearNode) {
        yearNode = {
          id:
            `year:${temporal.selectedYear}`,
          level: "year",
          type: "year-field",
          position: {
            x: 0,
            y: 0,
            z: 0
          },
          temporal: {
            patternYear:
              temporal.selectedYear
          }
        };
      }

      return yearNode;
    }

    function ensureNavigationFocus(context = {}) {
      if (!state.navigation) {
        return null;
      }

      let focus =
        state.navigation.getFocus?.();

      if (focus) {
        return focus;
      }

      focus =
        initialFocusNode(context);

      state.navigation.setFocus?.(
        focus,
        {
          silent: true
        }
      );

      state.navigation.pushPath?.(
        focus
      );

      return focus;
    }

    function buildVisibleWorld(context = {}) {
      const temporal =
        resolveSelectedTemporal(context);

      const {
        years
      } =
        resolveYears(context);

      const navigation =
        state.navigation;

      let focus =
        ensureNavigationFocus(context);

      let level =
        normalizeFocusLevel(
          navigation?.getLevel?.() ||
          focus?.level ||
          "year"
        );

      /*
       * Keep canonical selected year authoritative until
       * the user explicitly flies into another Year World.
       */
      if (
        focus?.level === "year" &&
        temporalYear(focus) !==
          temporal.selectedYear &&
        navigation?.breadcrumb?.().length <= 1
      ) {
        const yearNodes =
          WorldModel.buildYearField({
            years,
            anchorYear:
              temporal.selectedYear
          });

        const canonicalYear =
          yearNodes.find(
            node =>
              temporalYear(node) ===
              temporal.selectedYear
          );

        if (canonicalYear) {
          focus =
            canonicalYear;

          navigation.setFocus?.(
            canonicalYear,
            {
              silent: true
            }
          );
        }
      }

      let buildResult = null;

      if (
        state.builder?.buildForFocus
      ) {
        try {
          buildResult =
            state.builder.buildForFocus({
              level,
              focusNode: focus,
              years,
              anchorYear:
                temporal.selectedYear,
              options: {
                detail: "full"
              }
            });
        } catch (_) {
          buildResult = null;
        }
      }

      let nodes =
        Array.isArray(
          buildResult?.visible
        )
          ? buildResult.visible
          : [];

      /*
       * Year-level navigation must still show the
       * surrounding multi-year field, not just one year
       * plus its Moon children.
       */
      if (level === "year") {
        const yearNodes =
          WorldModel.buildYearField({
            years,
            anchorYear:
              temporal.selectedYear
          });

        const moonNodes =
          focus
            ? WorldModel.buildMoonField({
                year:
                  temporalYear(focus),
                yearPosition:
                  focus.position || {}
              })
            : [];

        nodes = [
          ...yearNodes,
          ...moonNodes
        ];
      }

      /*
       * Moon world:
       * focused Moon + structural weeks + all 28 days.
       */
      if (
        level === "moon" &&
        focus
      ) {
        const year =
          temporalYear(focus);

        const moon =
          temporalMoon(focus);

        if (
          Number.isFinite(year) &&
          Number.isFinite(moon)
        ) {
          const weekNodes =
            WorldModel.buildWeekField({
              year,
              moon,
              moonPosition:
                focus.position || {}
            });

          const dayNodes =
            WorldModel.buildDayField({
              year,
              moon,
              moonPosition:
                focus.position || {}
            });

          nodes = [
            focus,
            ...weekNodes,
            ...dayNodes
          ];
        }
      }

      /*
       * Day world:
       * focused day + its 24-hour orbit.
       */
      if (
        level === "day" &&
        focus
      ) {
        const year =
          temporalYear(focus);

        const moon =
          temporalMoon(focus);

        const day =
          temporalDay(focus);

        if (
          Number.isFinite(year) &&
          Number.isFinite(moon) &&
          Number.isFinite(day)
        ) {
          const hourNodes =
            WorldModel.buildHourField({
              year,
              moon,
              day,
              dayPosition:
                focus.position || {}
            });

          nodes = [
            focus,
            ...hourNodes
          ];
        }
      }

      /*
       * Hour and deeper currently retain the focused
       * local world. Event/record population comes next.
       */
      if (
        (
          level === "hour" ||
          level === "event" ||
          level === "record"
        ) &&
        focus
      ) {
        nodes = [
          focus
        ];
      }

      if (!nodes.length) {
        nodes =
          WorldModel.buildYearField({
            years,
            anchorYear:
              temporal.selectedYear
          });
      }

      const selectedId =
        focus?.id ||
        `year:${temporal.selectedYear}`;

      let projected = {
        nodes: [],
        connections: []
      };

      if (
        RenderProjection?.projectScene
      ) {
        try {
          projected =
            RenderProjection.projectScene({
              nodes,
              edges: [],
              selectedId,
              detail: "full"
            }) ||
            projected;
        } catch (_) {}
      }

      if (
        !Array.isArray(
          projected.nodes
        ) ||
        !projected.nodes.length
      ) {
        projected.nodes =
          nodes.map(
            node => ({
              id: node.id,
              node,
              level:
                node.level,
              position:
                node.position || {
                  x: 0,
                  y: 0,
                  z: 0
                },
              scale:
                node.id === selectedId
                  ? 0.11
                  : 0.065,
              interaction:
                {
                  id: node.id,
                  level:
                    node.level
                }
            })
          );
      }

      return {
        selectedYear:
          temporal.selectedYear,

        temporal,

        years,

        level,

        focus,

        nodes,

        projected,

        breadcrumb:
          navigation?.breadcrumb?.() ||
          [],

        navigation:
          navigation?.getState?.() ||
          null,

        buildResult
      };
    }

    function meshGeometryForLevel(
      level,
      scale
    ) {
      const THREE =
        state.THREE;

      switch (level) {
        case "year":
          return new THREE.IcosahedronGeometry(
            scale,
            1
          );

        case "moon":
          return new THREE.SphereGeometry(
            scale,
            12,
            8
          );

        case "week":
          return new THREE.TorusGeometry(
            scale,
            Math.max(
              0.004,
              scale * 0.09
            ),
            5,
            20
          );

        case "day":
          return new THREE.OctahedronGeometry(
            scale,
            0
          );

        case "hour":
          return new THREE.TetrahedronGeometry(
            scale,
            0
          );

        case "event":
        case "record":
          return new THREE.SphereGeometry(
            scale,
            8,
            6
          );

        default:
          return new THREE.IcosahedronGeometry(
            scale,
            0
          );
      }
    }

    function scaleForLevel(
      level,
      projectedScale
    ) {
      const fallback = {
        global: 0.32,
        collective: 0.28,
        lifetime: 0.25,
        "multi-year": 0.19,
        year: 0.13,
        moon: 0.075,
        week: 0.055,
        day: 0.038,
        hour: 0.021,
        event: 0.018,
        record: 0.014
      };

      const projected =
        safeNumber(
          projectedScale,
          NaN
        );

      if (
        Number.isFinite(projected) &&
        projected > 0
      ) {
        return Math.max(
          0.008,
          projected
        );
      }

      return fallback[level] || 0.03;
    }

    function buildWorldMesh(
      node,
      projected,
      focusId
    ) {
      const THREE =
        state.THREE;

      const level =
        node?.level ||
        projected?.level ||
        "year";

      const scale =
        scaleForLevel(
          level,
          projected?.scale
        );

      const geometry =
        meshGeometryForLevel(
          level,
          scale
        );

      const selected =
        String(node?.id) ===
        String(focusId);

      const structural =
        level === "week";

      const material =
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity:
            selected
              ? 0.94
              : structural
                ? 0.26
                : Math.max(
                    0.2,
                    safeNumber(
                      projected?.opacity,
                      0.46
                    )
                  ),
          depthWrite: false,
          wireframe:
            structural
        });

      const mesh =
        new THREE.Mesh(
          geometry,
          material
        );

      const position =
        projected?.position ||
        node?.position ||
        {
          x: 0,
          y: 0,
          z: 0
        };

      mesh.position.set(
        safeNumber(position.x),
        safeNumber(position.y),
        safeNumber(position.z)
      );

      if (selected) {
        mesh.scale.setScalar(
          1.28
        );
      }

      mesh.userData = {
        extension:
          EXTENSION_ID,

        type:
          "life-atlas-world",

        level,

        nodeId:
          node?.id || null,

        parentId:
          node?.parentId || null,

        temporal: {
          ...(
            node?.temporal ||
            {}
          )
        },

        interactionTarget:
          projected?.interaction ||
          projected?.interactionTarget ||
          node?.id ||
          null,

        selected
      };

      return mesh;
    }

    function rebuild(context = {}) {
      if (
        !state.mounted ||
        !state.enabled ||
        !state.THREE ||
        !state.yearGroup
      ) {
        return false;
      }

      state.lastContext =
        context;

      const result =
        buildVisibleWorld(context);

      clearGroup(
        state.yearGroup
      );

      clearGroup(
        state.connectionGroup
      );

      const nodeLookup =
        new Map(
          result.nodes.map(
            node => [
              String(node.id),
              node
            ]
          )
        );

      result.projected.nodes
        .forEach(projected => {
          const node =
            projected.node ||
            nodeLookup.get(
              String(
                projected.id ||
                projected.nodeId ||
                ""
              )
            );

          if (!node) return;

          const mesh =
            buildWorldMesh(
              node,
              projected,
              result.focus?.id
            );

          state.yearGroup.add(
            mesh
          );
        });

      (
        result.projected
          .connections ||
        []
      ).forEach(connection => {
        const line =
          buildConnection(
            connection
          );

        if (line) {
          state.connectionGroup
            .add(line);
        }
      });

      state.activeYear =
        result.selectedYear;

      state.projection =
        result;

      state.revision += 1;

      context.requestRender?.();

      return true;
    }

    function findProjectedNode(
      nodeId
    ) {
      const result =
        state.projection;

      if (!result) {
        return null;
      }

      const id =
        String(nodeId || "");

      return (
        result.nodes.find(
          node =>
            String(node.id) === id
        ) ||
        null
      );
    }

    function enterNode(
      nodeId,
      options = {}
    ) {
      if (
        !state.navigation ||
        !state.projection
      ) {
        return false;
      }

      const node =
        findProjectedNode(
          nodeId
        );

      if (!node) {
        return false;
      }

      const level =
        node.level;

      /*
       * Week nodes are structural guides.
       * Entering them focuses the week but keeps the
       * semantic Moon field visible.
       */
      if (level === "week") {
        state.navigation.setFocus?.(
          node,
          {
            silent: true
          }
        );

        state.navigation.pushPath?.(
          node
        );

        rebuild(
          state.lastContext || {}
        );

        return true;
      }

      state.navigation.enter?.(
        node,
        {
          duration:
            Number(
              options.duration
            ) || 850,

          reason:
            options.reason ||
            "sphere-world-enter"
        }
      );

      rebuild(
        state.lastContext || {}
      );

      return true;
    }

    function exitNode(
      options = {}
    ) {
      if (!state.navigation) {
        return false;
      }

      state.navigation.exit?.(
        null,
        {
          duration:
            Number(
              options.duration
            ) || 750,

          reason:
            options.reason ||
            "sphere-world-exit"
        }
      );

      rebuild(
        state.lastContext || {}
      );

      return true;
    }

    function updateNavigationFlight(
      nowMs
    ) {
      if (
        !state.navigation?.getFlight?.()
          ?.active
      ) {
        return false;
      }

      state.navigation.updateFlight?.(
        nowMs
      );

      const navState =
        state.navigation.getState?.();

      const camera =
        navState?.camera;

      if (
        camera &&
        state.lastContext?.camera
      ) {
        /*
         * Life Atlas navigation is renderer-independent.
         * The existing Sphere camera remains authoritative
         * for orbit mechanics. We map the world target into
         * that camera without replacing its controller.
         */
        globalThis
          .LivingTimeSphereCamera
          ?.moveTo?.({
            dist:
              camera.distance,

            targetX:
              camera.target?.x,

            targetY:
              camera.target?.y,

            targetZ:
              camera.target?.z,

            nowMs,

            animated: false
          });
      }

      state.lastContext
        ?.requestRender?.();

      return true;
    }

    function mount(context = {}) {
      if (state.mounted) {
        rebuild(context);
        return true;
      }

      const scene =
        context.scene;

      const THREE =
        context.THREE;

      if (
        !scene ||
        !THREE
      ) {
        return false;
      }

      state.scene = scene;
      state.THREE = THREE;
      state.camera =
        context.camera || null;

      const rootGroup =
        new THREE.Group();

      rootGroup.name =
        "LifeAtlasTemporalWorldRoot";

      const yearGroup =
        new THREE.Group();

      yearGroup.name =
        "LifeAtlasYearWorlds";

      const connectionGroup =
        new THREE.Group();

      connectionGroup.name =
        "LifeAtlasWorldConnections";

      rootGroup.add(yearGroup);
      rootGroup.add(connectionGroup);

      scene.add(rootGroup);

      state.rootGroup =
        rootGroup;

      state.yearGroup =
        yearGroup;

      state.connectionGroup =
        connectionGroup;

      if (
        WorldBuilder?.createBuilder
      ) {
        try {
          state.builder =
            WorldBuilder.createBuilder();
        } catch (_) {}
      }

      if (
        WorldNavigation?.createNavigation
      ) {
        try {
          state.navigation =
            WorldNavigation.createNavigation();
        } catch (_) {}
      }

      state.mounted = true;

      rebuild(context);

      return true;
    }

    function update(context = {}) {
      state.lastContext =
        context;

      return rebuild(context);
    }

    function pick(context = {}) {
      if (
        !state.mounted ||
        !state.enabled ||
        !state.rootGroup
      ) {
        return null;
      }

      const raycaster =
        context.raycaster;

      if (
        !raycaster ||
        typeof raycaster.intersectObject !==
          "function"
      ) {
        return null;
      }

      let hits = [];

      try {
        hits =
          raycaster.intersectObject(
            state.rootGroup,
            true
          ) || [];
      } catch (_) {
        return null;
      }

      for (const hit of hits) {
        let object =
          hit?.object || null;

        while (object) {
          const nodeId =
            object.userData?.nodeId ||
            object.userData
              ?.interactionTarget ||
            null;

          if (nodeId) {
            const node =
              findProjectedNode(
                String(nodeId)
              );

            if (!node) {
              break;
            }

            const entered =
              enterNode(
                String(nodeId),
                {
                  duration: 850,
                  reason:
                    "sphere-world-pick"
                }
              );

            if (!entered) {
              return null;
            }

            context.requestRender?.();

            const temporal = {
              ...(node.temporal || {})
            };

            let label =
              String(
                node.level ||
                "Life Atlas"
              );

            if (
              node.level === "year"
            ) {
              label =
                `Year ${
                  temporal.patternYear ??
                  temporal.year ??
                  ""
                }`;
            } else if (
              node.level === "moon"
            ) {
              label =
                `Moon ${
                  temporal.moon ?? ""
                }`;
            } else if (
              node.level === "week"
            ) {
              label =
                `Week ${
                  temporal.week ?? ""
                }`;
            } else if (
              node.level === "day"
            ) {
              label =
                `Moon ${
                  temporal.moon ?? ""
                } · Day ${
                  temporal.moonDay ?? ""
                }`;
            } else if (
              node.level === "hour"
            ) {
              label =
                `Hour ${
                  temporal.hour ?? ""
                }`;
            }

            return {
              handled: true,
              type:
                "life-atlas-world",

              nodeId:
                String(nodeId),

              level:
                node.level || null,

              temporal,
              label,

              position: {
                x:
                  Number(
                    hit.point?.x ??
                    node.position?.x ??
                    0
                  ) || 0,

                y:
                  Number(
                    hit.point?.y ??
                    node.position?.y ??
                    0
                  ) || 0,

                z:
                  Number(
                    hit.point?.z ??
                    node.position?.z ??
                    0
                  ) || 0
              }
            };
          }

          object =
            object.parent || null;
        }
      }

      return null;
    }

    function render(context = {}, nowMs = 0) {
      if (!state.mounted) {
        return false;
      }

      if (context && typeof context === "object") {
        state.lastContext = {
          ...(state.lastContext || {}),
          ...context
        };
      }

      updateNavigationFlight(
        Number(nowMs) ||
        Number(context?.nowMs) ||
        (
          typeof performance !== "undefined"
            ? performance.now()
            : Date.now()
        )
      );

      return true;
    }

    function dispose() {
      if (
        state.rootGroup &&
        state.scene
      ) {
        try {
          clearGroup(
            state.yearGroup
          );

          clearGroup(
            state.connectionGroup
          );

          state.scene.remove(
            state.rootGroup
          );
        } catch (_) {}
      }

      state.mounted = false;
      state.scene = null;
      state.camera = null;
      state.THREE = null;
      state.rootGroup = null;
      state.yearGroup = null;
      state.connectionGroup = null;
      state.builder = null;
      state.navigation = null;
      state.projection = null;
      state.lastContext = null;
    }

    function setEnabled(value) {
      state.enabled =
        value !== false;

      if (state.rootGroup) {
        state.rootGroup.visible =
          state.enabled;
      }

      return state.enabled;
    }

    function diagnostics() {
      return {
        version: VERSION,
        extensionId:
          EXTENSION_ID,

        mounted:
          state.mounted,

        enabled:
          state.enabled,

        activeYear:
          state.activeYear,

        revision:
          state.revision,

        visibleYears:
          state.yearGroup
            ?.children
            ?.length || 0,

        visibleConnections:
          state.connectionGroup
            ?.children
            ?.length || 0
      };
    }

    return Object.freeze({
      id: EXTENSION_ID,
      version: VERSION,
      mount,
      update,
      render,
      pick,
      dispose,

      enterNode,
      exitNode,

      getNavigationState() {
        return (
          state.navigation
            ?.getState?.() ||
          null
        );
      },

      getVisibleWorld() {
        return state.projection;
      },

      setEnabled,
      diagnostics
    });
  }
);
