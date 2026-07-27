using UnityEngine;

public sealed class StageThemeSwitcher : MonoBehaviour
{
    public Transform playerRoot;
    public Transform[] stageThemes = new Transform[0];
    public Transform[] stageFocusPoints = new Transform[0];
    public bool showDebugButtons = true;

    private int currentStage;

    private void Awake()
    {
        if (playerRoot == null)
        {
            GameObject player = GameObject.Find("PlayerRoot");
            if (player != null)
            {
                playerRoot = player.transform;
            }
        }

        SetStage(0, false);
    }

    private void OnGUI()
    {
        if (!showDebugButtons)
        {
            return;
        }

        GUILayout.BeginArea(new Rect(16f, 16f, 150f, 260f), GUI.skin.box);
        GUILayout.Label("Stage Theme");

        for (int i = 0; i < stageThemes.Length; i++)
        {
            string label = currentStage == i ? $"> Stage {i + 1}" : $"Stage {i + 1}";
            if (GUILayout.Button(label, GUILayout.Height(32f)))
            {
                SetStage(i, true);
            }
        }

        GUILayout.EndArea();
    }

    public void SetStage(int stageIndex, bool movePlayer)
    {
        if (stageThemes == null || stageThemes.Length == 0)
        {
            return;
        }

        currentStage = Mathf.Clamp(stageIndex, 0, stageThemes.Length - 1);

        for (int i = 0; i < stageThemes.Length; i++)
        {
            if (stageThemes[i] != null)
            {
                stageThemes[i].gameObject.SetActive(i == currentStage);
            }
        }

        if (movePlayer)
        {
            MovePlayerToStage(currentStage);
        }
    }

    private void MovePlayerToStage(int stageIndex)
    {
        if (playerRoot == null || stageFocusPoints == null || stageIndex >= stageFocusPoints.Length)
        {
            return;
        }

        Transform focusPoint = stageFocusPoints[stageIndex];
        if (focusPoint == null)
        {
            return;
        }

        Vector3 position = focusPoint.position;
        position.y = playerRoot.position.y;
        playerRoot.position = position;
        playerRoot.rotation = focusPoint.rotation;

        Rigidbody[] rigidbodies = playerRoot.GetComponentsInChildren<Rigidbody>();
        foreach (Rigidbody body in rigidbodies)
        {
            body.linearVelocity = Vector3.zero;
            body.angularVelocity = Vector3.zero;
        }
    }
}
