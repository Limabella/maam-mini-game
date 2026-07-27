using UnityEngine;

[DisallowMultipleComponent]
public sealed class BikePedalRunnerController : MonoBehaviour
{
    [Header("Pedal Input")]
    [SerializeField] private KeyCode pedalForwardKey = KeyCode.W;
    [SerializeField] private KeyCode pedalBackKey = KeyCode.S;
    [SerializeField] private bool requireAlternatingPedals = true;
    [SerializeField, Min(0f)] private float pedalGain = 0.18f;
    [SerializeField, Min(0f)] private float pedalDecayPerSecond = 0.55f;
    [SerializeField, Min(0f)] private float missedPedalPenalty = 0.08f;

    [Header("Speed")]
    [SerializeField, Min(0f)] private float idleSpeed = 1.5f;
    [SerializeField, Min(0f)] private float maxSpeed = 14f;
    [SerializeField, Min(0f)] private float acceleration = 16f;
    [SerializeField, Min(0f)] private float braking = 20f;

    [Header("Lane Movement")]
    [SerializeField] private bool useLaneMovement = true;
    [SerializeField] private KeyCode leftKey = KeyCode.A;
    [SerializeField] private KeyCode rightKey = KeyCode.D;
    [SerializeField, Min(1)] private int laneCount = 3;
    [SerializeField, Min(0.1f)] private float laneWidth = 2.5f;
    [SerializeField, Min(0f)] private float laneChangeSpeed = 12f;

    [Header("Bike Visual Motion")]
    [Tooltip("Optional. If assigned, this transform is forced to follow the bike root as a separate visual attachment point.")]
    [SerializeField] private Transform bikeVisualRoot;
    [Tooltip("Optional. If assigned, this transform is kept attached to the seat anchor so the rider stays visually fixed while the bike moves.")]
    [SerializeField] private Transform riderRoot;
    [Tooltip("Optional. Assign the pedal crank / pedal assembly root so it can visibly rotate with the pedal taps.")]
    [SerializeField] private Transform pedalCrankRoot;
    [Tooltip("Optional. Use this as the exact seat anchor. If empty, the current GameObject transform is used.")]
    [SerializeField] private Transform riderSeatAnchor;
    [Tooltip("Optional. If assigned, the rider animator is disabled so the character stays still while the bike moves like a chassis.")]
    [SerializeField] private Animator riderAnimator;
    [SerializeField] private bool disableRiderAnimatorOnStart = true;
    [SerializeField] private bool keepRiderLockedToSeat = true;

    [Header("Movement Axis")]
    [SerializeField] private Vector3 forwardDirection = Vector3.forward;

    [Header("Train-Like Feel")]
    [SerializeField, Min(0f)] private float bodyBobAmplitude = 0.03f;
    [SerializeField, Min(0f)] private float bodyBobFrequency = 4f;
    [SerializeField, Min(0f)] private float bodyYawAmplitude = 0.35f;
    [SerializeField, Min(0f)] private float bodyPitchAmplitude = 0.25f;
    [SerializeField, Min(0f)] private float bodyRollAmplitude = 0.15f;
    [SerializeField, Min(0f)] private float pedalImpulseRotation = 30f;
    [SerializeField, Min(0f)] private float pedalCadenceRotationSpeed = 180f;
    [SerializeField, Min(0f)] private float pedalMotionSmoothing = 10f;
    [SerializeField] private Vector3 pedalRotationAxis = Vector3.right;

    private KeyCode lastPedalKey = KeyCode.None;
    private float pedalPower;
    private float pedalPulse;
    private float pedalCrankAngle;
    private float currentSpeed;
    private int currentLane;
    private float startX;
    private Vector3 baseLocalBikeVisualPosition;
    private Quaternion baseLocalBikeVisualRotation;
    private Quaternion baseLocalPedalCrankRotation;

    public float PedalPower => pedalPower;
    public float CurrentSpeed => currentSpeed;
    public int CurrentLane => currentLane;

    private void Awake()
    {
        currentSpeed = idleSpeed;
        currentLane = laneCount / 2;
        startX = transform.position.x;
        forwardDirection = forwardDirection.sqrMagnitude > 0f ? forwardDirection.normalized : Vector3.forward;

        if (bikeVisualRoot == null)
        {
            bikeVisualRoot = transform;
        }

        baseLocalBikeVisualPosition = bikeVisualRoot.localPosition;
        baseLocalBikeVisualRotation = bikeVisualRoot.localRotation;
        baseLocalPedalCrankRotation = pedalCrankRoot != null ? pedalCrankRoot.localRotation : Quaternion.identity;

        if (disableRiderAnimatorOnStart && riderAnimator != null)
        {
            riderAnimator.enabled = false;
        }
    }

    private void Update()
    {
        ReadPedalInput();
        ReadLaneInput();

        pedalPower = Mathf.Clamp01(pedalPower - pedalDecayPerSecond * Time.deltaTime);
        pedalPulse = Mathf.MoveTowards(pedalPulse, 0f, pedalMotionSmoothing * Time.deltaTime);

        float targetSpeed = Mathf.Lerp(idleSpeed, maxSpeed, pedalPower);
        float speedChangeRate = targetSpeed >= currentSpeed ? acceleration : braking;
        currentSpeed = Mathf.MoveTowards(currentSpeed, targetSpeed, speedChangeRate * Time.deltaTime);

        UpdatePedalMotion();

        MoveRunner();
    }

    private void LateUpdate()
    {
        if (!keepRiderLockedToSeat || riderRoot == null)
        {
            return;
        }

        Transform anchor = riderSeatAnchor != null ? riderSeatAnchor : transform;
        riderRoot.SetPositionAndRotation(anchor.position, anchor.rotation);
    }

    private void ReadPedalInput()
    {
        bool pressedForward = Input.GetKeyDown(pedalForwardKey);
        bool pressedBack = Input.GetKeyDown(pedalBackKey);

        if (!pressedForward && !pressedBack)
        {
            return;
        }

        KeyCode pressedKey = pressedForward ? pedalForwardKey : pedalBackKey;
        bool isValidPedal = !requireAlternatingPedals || pressedKey != lastPedalKey;

        if (isValidPedal)
        {
            pedalPower = Mathf.Clamp01(pedalPower + pedalGain);
            pedalPulse = Mathf.Clamp01(pedalPulse + 0.85f);
            lastPedalKey = pressedKey;
            return;
        }

        pedalPower = Mathf.Clamp01(pedalPower - missedPedalPenalty);
    }

    private void ReadLaneInput()
    {
        if (!useLaneMovement)
        {
            return;
        }

        if (Input.GetKeyDown(leftKey))
        {
            currentLane = Mathf.Max(0, currentLane - 1);
        }

        if (Input.GetKeyDown(rightKey))
        {
            currentLane = Mathf.Min(laneCount - 1, currentLane + 1);
        }
    }

    private void MoveRunner()
    {
        Vector3 nextPosition = transform.position + forwardDirection * (currentSpeed * Time.deltaTime);

        if (useLaneMovement)
        {
            float centerOffset = (laneCount - 1) * 0.5f;
            float targetX = startX + (currentLane - centerOffset) * laneWidth;
            nextPosition.x = Mathf.Lerp(transform.position.x, targetX, laneChangeSpeed * Time.deltaTime);
        }

        transform.position = nextPosition;

        ApplyChassisMotion();
    }

    private void UpdatePedalMotion()
    {
        if (pedalCrankRoot == null)
        {
            return;
        }

        Vector3 axis = pedalRotationAxis.sqrMagnitude > 0f ? pedalRotationAxis.normalized : Vector3.right;
        float cadenceSpeed = pedalCadenceRotationSpeed * Mathf.Lerp(0.35f, 1f, pedalPower);
        pedalCrankAngle += cadenceSpeed * Time.deltaTime;
        pedalCrankAngle += pedalImpulseRotation * pedalPulse * Time.deltaTime;

        pedalCrankRoot.localRotation = baseLocalPedalCrankRotation * Quaternion.AngleAxis(pedalCrankAngle, axis);
    }

    private void ApplyChassisMotion()
    {
        if (bikeVisualRoot == null)
        {
            return;
        }

        float cadencePhase = Time.time * bodyBobFrequency;
        float pedalDrive = Mathf.Lerp(0.15f, 1f, pedalPower);
        float pulse = Mathf.Sin(cadencePhase) * bodyBobAmplitude * pedalDrive;
        float pitch = Mathf.Sin(cadencePhase + 1.57f) * bodyPitchAmplitude * pedalDrive;
        float roll = Mathf.Sin(cadencePhase * 0.5f) * bodyRollAmplitude * pedalDrive;
        float yaw = Mathf.Sin(cadencePhase * 0.5f) * bodyYawAmplitude * pedalDrive;

        Vector3 speedNudge = forwardDirection * (pedalPulse * 0.02f);
        bikeVisualRoot.localPosition = baseLocalBikeVisualPosition + new Vector3(0f, pulse, 0f) + speedNudge;
        bikeVisualRoot.localRotation = baseLocalBikeVisualRotation * Quaternion.Euler(pitch, yaw, roll);
    }
}
