using UnityEditor;
using UnityEngine;

public static class RoadEnvironmentBuilder
{
    private const float RoadWidth = 6.8f;
    private const float SidewalkWidth = 2.15f;
    private const float SidewalkHeight = 0.18f;
    private const float RoadHeight = 0.1f;
    private const float TargetGroundWidth = 12.4f;
    private const float GroundLengthMultiplier = 5f;
    private const float GroundLengthPadding = 2f;
    private const float FenceEndInset = 4f;
    private const float CrossingInset = 6f;
    private const float MinimumRoadLength = 30f;
    private const float CrossingGapHalfLength = 3.2f;
    private const float RobotPathHeight = 0.42f;
    private const float RobotCrossingOffset = 2.4f;
    private const float FinishLineInset = 8f;
    private const int ObstacleSeed = 1207;
    private const int ObstacleCount = 28;
    private const float ObstacleStartInset = 12f;
    private const float ObstacleFinishInset = 18f;

    [MenuItem("Tools/Pedalrun/Create Road Environment")]
    public static void CreateRoadEnvironment()
    {
        GameObject ground = GameObject.Find("Ground");
        GroundLayout layout = ResolveGroundLayout(ground);

        GameObject root = FindOrCreateRoot("RoadEnvironment");
        root.transform.position = layout.Center;
        ClearChildren(root.transform);
        float[] crossingPositions = CalculateCrossingPositions(layout);

        CreateRoad(root.transform, layout);
        CreateSidewalks(root.transform, layout);
        CreateGuardRails(root.transform, layout, crossingPositions);
        CreateCrossings(root.transform, layout, crossingPositions);
        CreateFinishLine(root.transform, layout);
        CreateDeliveryRobotPaths(root.transform, layout, crossingPositions);
        CreateRandomObstacles(root.transform, layout, crossingPositions);

        Selection.activeGameObject = root;
        EditorGUIUtility.PingObject(root);
    }

    private readonly struct GroundLayout
    {
        public GroundLayout(Vector3 center, float roadLength)
        {
            Center = center;
            RoadLength = roadLength;
        }

        public Vector3 Center { get; }
        public float RoadLength { get; }
    }

    private static GameObject FindOrCreateRoot(string objectName)
    {
        GameObject root = GameObject.Find(objectName);
        if (root != null)
        {
            Undo.RegisterFullObjectHierarchyUndo(root, "Rebuild Road Environment");
            return root;
        }

        root = new GameObject(objectName);
        Undo.RegisterCreatedObjectUndo(root, "Create Road Environment");
        return root;
    }

    private static void ClearChildren(Transform root)
    {
        for (int i = root.childCount - 1; i >= 0; i--)
        {
            Undo.DestroyObjectImmediate(root.GetChild(i).gameObject);
        }
    }

    private static GroundLayout ResolveGroundLayout(GameObject ground)
    {
        if (ground == null)
        {
            return new GroundLayout(Vector3.zero, 80f);
        }

        RoadEnvironmentGroundSettings settings = ground.GetComponent<RoadEnvironmentGroundSettings>();
        if (settings == null)
        {
            settings = Undo.AddComponent<RoadEnvironmentGroundSettings>(ground);
        }

        Vector3 currentGroundSize = GetWorldSize(ground);
        if (settings.baseGroundWidth <= 0f)
        {
            settings.baseGroundWidth = currentGroundSize.x;
        }

        if (settings.baseGroundLength <= 0f)
        {
            settings.baseGroundLength = currentGroundSize.z;
        }

        Undo.RecordObject(ground.transform, "Adjust Ground Width");
        Undo.RecordObject(settings, "Capture Ground Base Size");
        NarrowGroundWidth(ground, TargetGroundWidth);
        ExtendGroundLength(ground, settings.baseGroundLength * GroundLengthMultiplier);

        Vector3 groundSize = GetWorldSize(ground);
        float roadLength = Mathf.Max(MinimumRoadLength, groundSize.z - GroundLengthPadding);

        return new GroundLayout(ground.transform.position, roadLength);
    }

    private static void NarrowGroundWidth(GameObject ground, float targetWidth)
    {
        MeshFilter meshFilter = ground.GetComponent<MeshFilter>();
        if (meshFilter == null || meshFilter.sharedMesh == null)
        {
            Vector3 scale = ground.transform.localScale;
            ground.transform.localScale = new Vector3(targetWidth, scale.y, scale.z);
            return;
        }

        Vector3 meshSize = meshFilter.sharedMesh.bounds.size;
        if (meshSize.x <= 0f)
        {
            return;
        }

        Vector3 scaleValue = ground.transform.localScale;
        scaleValue.x = targetWidth / meshSize.x;
        ground.transform.localScale = scaleValue;
    }

    private static void ExtendGroundLength(GameObject ground, float targetLength)
    {
        MeshFilter meshFilter = ground.GetComponent<MeshFilter>();
        if (meshFilter == null || meshFilter.sharedMesh == null)
        {
            Vector3 scale = ground.transform.localScale;
            ground.transform.localScale = new Vector3(scale.x, scale.y, targetLength);
            return;
        }

        Vector3 meshSize = meshFilter.sharedMesh.bounds.size;
        if (meshSize.z <= 0f)
        {
            return;
        }

        Vector3 scaleValue = ground.transform.localScale;
        scaleValue.z = targetLength / meshSize.z;
        ground.transform.localScale = scaleValue;
    }

    private static Vector3 GetWorldSize(GameObject gameObject)
    {
        Renderer renderer = gameObject.GetComponent<Renderer>();
        if (renderer != null)
        {
            return renderer.bounds.size;
        }

        MeshFilter meshFilter = gameObject.GetComponent<MeshFilter>();
        if (meshFilter != null && meshFilter.sharedMesh != null)
        {
            return Vector3.Scale(meshFilter.sharedMesh.bounds.size, gameObject.transform.lossyScale);
        }

        return gameObject.transform.lossyScale;
    }

    private static void CreateRoad(Transform parent, GroundLayout layout)
    {
        CreatePrimitive(
            "Road_Main",
            PrimitiveType.Cube,
            parent,
            new Vector3(0f, 0.05f, 0f),
            new Vector3(RoadWidth, RoadHeight, layout.RoadLength),
            new Color(0.18f, 0.18f, 0.18f)
        );

        CreatePrimitive(
            "Road_CenterLine",
            PrimitiveType.Cube,
            parent,
            new Vector3(0f, 0.11f, 0f),
            new Vector3(0.18f, 0.01f, layout.RoadLength),
            new Color(0.95f, 0.78f, 0.18f)
        );
    }

    private static void CreateSidewalks(Transform parent, GroundLayout layout)
    {
        CreateSidewalk(parent, layout, -1f, "Left");
        CreateSidewalk(parent, layout, 1f, "Right");
    }

    private static void CreateSidewalk(Transform parent, GroundLayout layout, float sideSign, string sideLabel)
    {
        float sidewalkCenterX = sideSign * ((RoadWidth * 0.5f) + (SidewalkWidth * 0.5f));
        float curbX = sideSign * ((RoadWidth * 0.5f) + 0.08f);

        CreatePrimitive(
            $"Sidewalk_{sideLabel}",
            PrimitiveType.Cube,
            parent,
            new Vector3(sidewalkCenterX, 0.11f, 0f),
            new Vector3(SidewalkWidth, SidewalkHeight, layout.RoadLength),
            new Color(0.68f, 0.68f, 0.68f)
        );

        CreatePrimitive(
            $"Curb_{sideLabel}",
            PrimitiveType.Cube,
            parent,
            new Vector3(curbX, 0.16f, 0f),
            new Vector3(0.14f, 0.16f, layout.RoadLength),
            new Color(0.82f, 0.82f, 0.82f)
        );
    }

    private static float[] CalculateCrossingPositions(GroundLayout layout)
    {
        float forwardLimit = (layout.RoadLength * 0.5f) - CrossingInset;
        float crossingA = Mathf.Clamp(forwardLimit * 0.35f, 10f, forwardLimit - 10f);
        float crossingB = Mathf.Clamp(forwardLimit * 0.72f, crossingA + 10f, forwardLimit);
        return new[] { crossingA, crossingB };
    }

    private static void CreateGuardRails(Transform parent, GroundLayout layout, float[] crossingPositions)
    {
        CreateOuterGuardRail(parent, layout, -1f, "Left");
        CreateOuterGuardRail(parent, layout, 1f, "Right");
        CreateInnerGuardRail(parent, layout, crossingPositions, -1f, "Left");
        CreateInnerGuardRail(parent, layout, crossingPositions, 1f, "Right");
    }

    private static void CreateOuterGuardRail(Transform parent, GroundLayout layout, float sideSign, string sideLabel)
    {
        GameObject railRoot = new GameObject($"GuardRail_Outer_{sideLabel}");
        Undo.RegisterCreatedObjectUndo(railRoot, "Create Guard Rail");
        railRoot.transform.SetParent(parent, false);

        float startZ = (-layout.RoadLength * 0.5f) + FenceEndInset;
        float endZ = (layout.RoadLength * 0.5f) - FenceEndInset;
        float postSpacing = 4f;
        float railX = sideSign * ((RoadWidth * 0.5f) + SidewalkWidth - 0.12f);

        for (float z = startZ; z <= endZ; z += postSpacing)
        {
            CreatePrimitive(
                $"GuardPost_{z:0}",
                PrimitiveType.Cube,
                railRoot.transform,
                new Vector3(railX, 0.7f, z),
                new Vector3(0.1f, 1.4f, 0.1f),
                new Color(0.74f, 0.76f, 0.78f)
            );
        }

        CreatePrimitive(
            "GuardRail_BeamUpper",
            PrimitiveType.Cube,
            railRoot.transform,
            new Vector3(railX, 1.08f, (startZ + endZ) * 0.5f),
            new Vector3(0.18f, 0.1f, endZ - startZ),
            new Color(0.82f, 0.84f, 0.86f)
        );

        CreatePrimitive(
            "GuardRail_BeamLower",
            PrimitiveType.Cube,
            railRoot.transform,
            new Vector3(railX, 0.74f, (startZ + endZ) * 0.5f),
            new Vector3(0.16f, 0.09f, endZ - startZ),
            new Color(0.76f, 0.78f, 0.8f)
        );

        CreatePrimitive(
            "GuardRail_Foot",
            PrimitiveType.Cube,
            railRoot.transform,
            new Vector3(railX, 0.08f, (startZ + endZ) * 0.5f),
            new Vector3(0.26f, 0.05f, endZ - startZ),
            new Color(0.5f, 0.5f, 0.5f)
        );
    }

    private static void CreateInnerGuardRail(Transform parent, GroundLayout layout, float[] crossingPositions, float sideSign, string sideLabel)
    {
        GameObject railRoot = new GameObject($"GuardRail_Inner_{sideLabel}");
        Undo.RegisterCreatedObjectUndo(railRoot, "Create Inner Guard Rail");
        railRoot.transform.SetParent(parent, false);

        float startZ = (-layout.RoadLength * 0.5f) + FenceEndInset;
        float endZ = (layout.RoadLength * 0.5f) - FenceEndInset;
        float railX = sideSign * ((RoadWidth * 0.5f) + 0.22f);

        float currentStart = startZ;
        for (int i = 0; i < crossingPositions.Length; i++)
        {
            float gapStart = crossingPositions[i] - CrossingGapHalfLength;
            float gapEnd = crossingPositions[i] + CrossingGapHalfLength;

            if (gapStart > currentStart)
            {
                CreateGuardRailSegment(railRoot.transform, railX, currentStart, gapStart, $"Segment_{i + 1}");
            }

            currentStart = gapEnd;
        }

        if (currentStart < endZ)
        {
            CreateGuardRailSegment(railRoot.transform, railX, currentStart, endZ, $"Segment_{crossingPositions.Length + 1}");
        }
    }

    private static void CreateGuardRailSegment(Transform parent, float railX, float segmentStartZ, float segmentEndZ, string segmentName)
    {
        if (segmentEndZ - segmentStartZ < 1f)
        {
            return;
        }

        GameObject segmentRoot = new GameObject(segmentName);
        Undo.RegisterCreatedObjectUndo(segmentRoot, "Create Guard Rail Segment");
        segmentRoot.transform.SetParent(parent, false);

        float postSpacing = 3f;
        for (float z = segmentStartZ; z <= segmentEndZ; z += postSpacing)
        {
            CreatePrimitive(
                $"InnerGuardPost_{z:0}",
                PrimitiveType.Cube,
                segmentRoot.transform,
                new Vector3(railX, 0.72f, z),
                new Vector3(0.1f, 1.44f, 0.1f),
                new Color(0.7f, 0.72f, 0.75f)
            );
        }

        float centerZ = (segmentStartZ + segmentEndZ) * 0.5f;
        float length = segmentEndZ - segmentStartZ;

        CreatePrimitive(
            "InnerGuardRail_BeamUpper",
            PrimitiveType.Cube,
            segmentRoot.transform,
            new Vector3(railX, 1.08f, centerZ),
            new Vector3(0.18f, 0.1f, length),
            new Color(0.82f, 0.84f, 0.86f)
        );

        CreatePrimitive(
            "InnerGuardRail_BeamLower",
            PrimitiveType.Cube,
            segmentRoot.transform,
            new Vector3(railX, 0.74f, centerZ),
            new Vector3(0.16f, 0.09f, length),
            new Color(0.76f, 0.78f, 0.8f)
        );
    }

    private static void CreateCrossings(Transform parent, GroundLayout layout, float[] crossingPositions)
    {
        for (int i = 0; i < crossingPositions.Length; i++)
        {
            CreateCrossing(parent, layout, $"Crossing_{i + 1:00}", crossingPositions[i]);
        }
    }

    private static void CreateDeliveryRobotPaths(Transform parent, GroundLayout layout, float[] crossingPositions)
    {
        GameObject pathRoot = new GameObject("DeliveryRobotPaths");
        Undo.RegisterCreatedObjectUndo(pathRoot, "Create Delivery Robot Paths");
        pathRoot.transform.SetParent(parent, false);

        CreateDeliveryRobotPath(pathRoot.transform, layout, crossingPositions, -1f, "Left");
        CreateDeliveryRobotPath(pathRoot.transform, layout, crossingPositions, 1f, "Right");
    }

    private static void CreateDeliveryRobotPath(
        Transform parent,
        GroundLayout layout,
        float[] crossingPositions,
        float sideSign,
        string sideLabel
    )
    {
        GameObject pathRoot = new GameObject($"RobotPath_{sideLabel}");
        Undo.RegisterCreatedObjectUndo(pathRoot, "Create Delivery Robot Path");
        pathRoot.transform.SetParent(parent, false);

        float sidewalkCenterX = sideSign * ((RoadWidth * 0.5f) + (SidewalkWidth * 0.5f));
        float startZ = (-layout.RoadLength * 0.5f) + 5f;
        float endZ = (layout.RoadLength * 0.5f) - 5f;

        float[] waypointZs =
        {
            startZ,
            crossingPositions[0] - RobotCrossingOffset,
            crossingPositions[0] + RobotCrossingOffset,
            crossingPositions[1] - RobotCrossingOffset,
            crossingPositions[1] + RobotCrossingOffset,
            endZ
        };

        for (int i = 0; i < waypointZs.Length; i++)
        {
            CreateWaypoint(
                pathRoot.transform,
                $"WP_{i + 1:00}",
                new Vector3(sidewalkCenterX, RobotPathHeight, waypointZs[i]),
                sideLabel == "Left" ? new Color(0.35f, 0.85f, 1f) : new Color(1f, 0.55f, 0.2f)
            );
        }
    }

    private static void CreateRandomObstacles(Transform parent, GroundLayout layout, float[] crossingPositions)
    {
        GameObject obstacleRoot = new GameObject("RandomObstacles");
        Undo.RegisterCreatedObjectUndo(obstacleRoot, "Create Random Obstacles");
        obstacleRoot.transform.SetParent(parent, false);

        Random.InitState(ObstacleSeed);

        float startZ = (-layout.RoadLength * 0.5f) + ObstacleStartInset;
        float endZ = (layout.RoadLength * 0.5f) - ObstacleFinishInset;
        float segmentLength = (endZ - startZ) / ObstacleCount;

        for (int i = 0; i < ObstacleCount; i++)
        {
            float segmentStart = startZ + (segmentLength * i);
            float z = segmentStart + Random.Range(segmentLength * 0.2f, segmentLength * 0.85f);

            if (IsNearCrossing(z, crossingPositions, CrossingGapHalfLength + 2f))
            {
                z += CrossingGapHalfLength + 4f;
            }

            float x = Random.Range(-RoadWidth * 0.35f, RoadWidth * 0.35f);
            float width = Random.Range(0.45f, 0.9f);
            float height = Random.Range(0.35f, 0.85f);
            float depth = Random.Range(0.45f, 1.2f);
            Color color = Random.value > 0.55f
                ? new Color(0.95f, 0.46f, 0.12f)
                : new Color(0.75f, 0.77f, 0.8f);

            GameObject obstacle = CreatePrimitive(
                $"SoftObstacle_{i + 1:00}",
                Random.value > 0.45f ? PrimitiveType.Cube : PrimitiveType.Cylinder,
                obstacleRoot.transform,
                new Vector3(x, 0.12f + (height * 0.5f), z),
                new Vector3(width, height, depth),
                color
            );

            obstacle.transform.localRotation = Quaternion.Euler(0f, Random.Range(-12f, 12f), 0f);
            ConfigureSoftObstacle(obstacle);
        }
    }

    private static bool IsNearCrossing(float z, float[] crossingPositions, float clearance)
    {
        for (int i = 0; i < crossingPositions.Length; i++)
        {
            if (Mathf.Abs(z - crossingPositions[i]) < clearance)
            {
                return true;
            }
        }

        return false;
    }

    private static void ConfigureSoftObstacle(GameObject obstacle)
    {
        SoftObstacle softObstacle = obstacle.GetComponent<SoftObstacle>();
        if (softObstacle == null)
        {
            softObstacle = Undo.AddComponent<SoftObstacle>(obstacle);
        }

        softObstacle.maxUpwardVelocity = 1.6f;
        softObstacle.maxHorizontalVelocity = 7.5f;
        softObstacle.dampingMultiplier = 0.38f;
        softObstacle.smallHopVelocity = 0.65f;

        Collider collider = obstacle.GetComponent<Collider>();
        if (collider != null)
        {
            PhysicsMaterial material = new PhysicsMaterial($"{obstacle.name}_LowBounce");
            material.bounciness = 0f;
            material.dynamicFriction = 0.8f;
            material.staticFriction = 0.9f;
            material.frictionCombine = PhysicsMaterialCombine.Maximum;
            material.bounceCombine = PhysicsMaterialCombine.Minimum;
            collider.sharedMaterial = material;
        }
    }

    private static void CreateFinishLine(Transform parent, GroundLayout layout)
    {
        GameObject finishRoot = new GameObject("FinishLine");
        Undo.RegisterCreatedObjectUndo(finishRoot, "Create Finish Line");
        finishRoot.transform.SetParent(parent, false);

        float finishZ = (layout.RoadLength * 0.5f) - FinishLineInset;
        float lineWidth = RoadWidth + (SidewalkWidth * 2f);

        CreatePrimitive(
            "FinishStripe",
            PrimitiveType.Cube,
            finishRoot.transform,
            new Vector3(0f, 0.13f, finishZ),
            new Vector3(lineWidth, 0.02f, 0.7f),
            new Color(0.94f, 0.94f, 0.94f)
        );

        CreatePrimitive(
            "FinishPost_Left",
            PrimitiveType.Cube,
            finishRoot.transform,
            new Vector3(-(lineWidth * 0.5f) + 0.35f, 1.8f, finishZ),
            new Vector3(0.14f, 3.6f, 0.14f),
            new Color(0.18f, 0.18f, 0.18f)
        );

        CreatePrimitive(
            "FinishPost_Right",
            PrimitiveType.Cube,
            finishRoot.transform,
            new Vector3((lineWidth * 0.5f) - 0.35f, 1.8f, finishZ),
            new Vector3(0.14f, 3.6f, 0.14f),
            new Color(0.18f, 0.18f, 0.18f)
        );

        CreatePrimitive(
            "FinishBanner",
            PrimitiveType.Cube,
            finishRoot.transform,
            new Vector3(0f, 3.1f, finishZ),
            new Vector3(lineWidth - 0.7f, 0.35f, 0.1f),
            new Color(0.96f, 0.28f, 0.22f)
        );
    }

    private static void CreateWaypoint(Transform parent, string objectName, Vector3 localPosition, Color color)
    {
        GameObject waypoint = new GameObject(objectName);
        Undo.RegisterCreatedObjectUndo(waypoint, $"Create {objectName}");
        waypoint.transform.SetParent(parent, false);
        waypoint.transform.localPosition = localPosition;

        GameObject marker = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        marker.name = "Marker";
        Undo.RegisterCreatedObjectUndo(marker, "Create Waypoint Marker");
        marker.transform.SetParent(waypoint.transform, false);
        marker.transform.localPosition = Vector3.zero;
        marker.transform.localScale = new Vector3(0.35f, 0.35f, 0.35f);

        Collider markerCollider = marker.GetComponent<Collider>();
        if (markerCollider != null)
        {
            Object.DestroyImmediate(markerCollider);
        }

        Renderer renderer = marker.GetComponent<Renderer>();
        if (renderer != null)
        {
            renderer.sharedMaterial = CreateMaterial($"{objectName}_MarkerMaterial", color);
        }
    }

    private static void CreateCrossing(Transform parent, GroundLayout layout, string crossingName, float zPosition)
    {
        GameObject crossingRoot = new GameObject(crossingName);
        Undo.RegisterCreatedObjectUndo(crossingRoot, "Create Crossing");
        crossingRoot.transform.SetParent(parent, false);
        crossingRoot.transform.localPosition = new Vector3(0f, 0f, zPosition);

        GameObject crosswalkRoot = new GameObject("Crosswalk");
        Undo.RegisterCreatedObjectUndo(crosswalkRoot, "Create Crosswalk");
        crosswalkRoot.transform.SetParent(crossingRoot.transform, false);

        for (int i = 0; i < 7; i++)
        {
            float stripeZ = -1.8f + (i * 0.6f);
            CreatePrimitive(
                $"Stripe_{i + 1}",
                PrimitiveType.Cube,
                crosswalkRoot.transform,
                new Vector3(0f, 0.12f, stripeZ),
                new Vector3(RoadWidth + 1.2f, 0.02f, 0.28f),
                new Color(0.94f, 0.94f, 0.94f)
            );
        }

        float leftTrafficLightX = -((RoadWidth * 0.5f) + SidewalkWidth - 0.45f);
        float rightTrafficLightX = (RoadWidth * 0.5f) + SidewalkWidth - 0.45f;

        CreateTrafficLight(crossingRoot.transform, "TrafficLight_Left", new Vector3(leftTrafficLightX, 0f, -2.4f), 180f);
        CreateTrafficLight(crossingRoot.transform, "TrafficLight_Right", new Vector3(rightTrafficLightX, 0f, -2.4f), 180f);
    }

    private static void CreateTrafficLight(Transform parent, string objectName, Vector3 localPosition, float yRotation)
    {
        GameObject trafficLightRoot = new GameObject(objectName);
        Undo.RegisterCreatedObjectUndo(trafficLightRoot, "Create Traffic Light");
        trafficLightRoot.transform.SetParent(parent, false);
        trafficLightRoot.transform.localPosition = localPosition;
        trafficLightRoot.transform.localRotation = Quaternion.Euler(0f, yRotation, 0f);

        CreatePrimitive(
            "Pole",
            PrimitiveType.Cube,
            trafficLightRoot.transform,
            new Vector3(0f, 1.6f, 0f),
            new Vector3(0.12f, 3.2f, 0.12f),
            new Color(0.2f, 0.2f, 0.2f)
        );

        CreatePrimitive(
            "LightBox",
            PrimitiveType.Cube,
            trafficLightRoot.transform,
            new Vector3(0f, 2.6f, 0f),
            new Vector3(0.34f, 0.9f, 0.2f),
            new Color(0.1f, 0.1f, 0.1f)
        );

        CreatePrimitive(
            "Red",
            PrimitiveType.Sphere,
            trafficLightRoot.transform,
            new Vector3(0f, 2.85f, -0.11f),
            new Vector3(0.12f, 0.12f, 0.12f),
            new Color(0.85f, 0.16f, 0.16f)
        );

        CreatePrimitive(
            "Yellow",
            PrimitiveType.Sphere,
            trafficLightRoot.transform,
            new Vector3(0f, 2.6f, -0.11f),
            new Vector3(0.12f, 0.12f, 0.12f),
            new Color(0.92f, 0.72f, 0.16f)
        );

        CreatePrimitive(
            "Green",
            PrimitiveType.Sphere,
            trafficLightRoot.transform,
            new Vector3(0f, 2.35f, -0.11f),
            new Vector3(0.12f, 0.12f, 0.12f),
            new Color(0.12f, 0.72f, 0.26f)
        );
    }

    private static GameObject CreatePrimitive(
        string objectName,
        PrimitiveType primitiveType,
        Transform parent,
        Vector3 localPosition,
        Vector3 localScale,
        Color color
    )
    {
        GameObject created = GameObject.CreatePrimitive(primitiveType);
        created.name = objectName;
        Undo.RegisterCreatedObjectUndo(created, $"Create {objectName}");
        created.transform.SetParent(parent, false);
        created.transform.localPosition = localPosition;
        created.transform.localRotation = Quaternion.identity;
        created.transform.localScale = localScale;

        Renderer renderer = created.GetComponent<Renderer>();
        if (renderer != null)
        {
            renderer.sharedMaterial = CreateMaterial($"{objectName}_Material", color);
        }

        return created;
    }

    private static Material CreateMaterial(string materialName, Color color)
    {
        Shader shader = Shader.Find("Universal Render Pipeline/Lit");
        if (shader == null)
        {
            shader = Shader.Find("Standard");
        }

        Material material = new Material(shader);
        material.name = materialName;
        material.color = color;
        return material;
    }
}
