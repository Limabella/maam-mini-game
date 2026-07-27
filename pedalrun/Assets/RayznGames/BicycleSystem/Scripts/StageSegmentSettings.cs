using UnityEngine;

public sealed class StageSegmentSettings : MonoBehaviour
{
    public int stageIndex;
    public float targetLapTimeMinutes = 5f;
    public float startZ;
    public float endZ;
    public string routeDirection = "Forward";
}
