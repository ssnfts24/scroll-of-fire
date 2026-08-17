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

    function buildWorldProjection(context = {}) {
      const {
        selectedYear,
        years
      } =
        resolveYears(context);

      let nodes = [];

      if (
        WorldModel?.buildYearField
      ) {
        try {
          const field =
            WorldModel.buildYearField({
              years,
              selectedYear
            });

          if (Array.isArray(field)) {
            nodes = field;
          } else if (
            Array.isArray(field?.nodes)
          ) {
            nodes = field.nodes;
          }
        } catch (_) {}
      }

      if (!nodes.length) {
        nodes =
          buildFallbackYearNodes(
            years,
            selectedYear
          );
      }

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
              selectedId:
                `life-atlas-year:${selectedYear}`,
              detail: "year"
            }) || projected;
        } catch (_) {}
      }

      if (
        !Array.isArray(projected.nodes) ||
        !projected.nodes.length
      ) {
        projected.nodes =
          nodes.map(node => ({
            id: node.id,
            node,
            position:
              node.position || {
                x: 0,
                y: 0,
                z: 0
              },
            scale:
              node.selected
                ? 0.11
                : 0.065
          }));
      }

      return {
        selectedYear,
        years,
        nodes,
        projected
      };
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

      const result =
        buildWorldProjection(context);

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

      result.projected.nodes.forEach(
        projected => {
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
            buildYearMesh(
              node,
              projected,
              result.selectedYear
            );

          state.yearGroup.add(mesh);
        }
      );

      (
        result.projected.connections ||
        []
      ).forEach(connection => {
        const line =
          buildConnection(
            connection
          );

        if (line) {
          state.connectionGroup.add(
            line
          );
        }
      });

      state.activeYear =
        result.selectedYear;

      state.projection =
        result;

      state.revision += 1;

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

    function render() {
      return state.mounted;
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
      dispose,
      setEnabled,
      diagnostics
    });
  }
);
