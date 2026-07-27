using UnityEngine;

namespace rayzngames
{
    public sealed class RunnerCameraFollow : MonoBehaviour
    {
        [SerializeField] Transform target;
        [SerializeField] BicycleVehicle vehicle;
        [SerializeField] BikeControlsExample controls;
        [SerializeField] Camera followCamera;

        [Header("Base Follow")]
        [SerializeField] Vector3 offset = new Vector3(0f, 1.6f, -5.2f);
        [SerializeField, Min(0f)] float followSmoothing = 8f;
        [SerializeField, Min(0f)] float rotationSmoothing = 8f;
        [SerializeField] bool followTargetRotation = true;
        [SerializeField] float lookHeight = 1.2f;

        [Header("Speed Feel")]
        [SerializeField] bool useSpeedFeel = true;
        [SerializeField] float speedFeelAtKmh = 35f;
        [SerializeField] float highSpeedFov = 82f;
        [SerializeField] float lowSpeedFov = 60f;
        [SerializeField] float highSpeedExtraDistance = 1.8f;
        [SerializeField] float highSpeedLowering = 0.35f;
        [SerializeField] float fovSmoothing = 8f;

        [Header("Steering Tilt")]
        [SerializeField] bool useSteeringTilt = true;
        [SerializeField] float maxRollAngle = 5f;
        [SerializeField] float rollSmoothing = 10f;

        [Header("Speed Lines")]
        [SerializeField] ParticleSystem speedLines;
        [SerializeField] float speedLinesStartKmh = 18f;
        [SerializeField] float speedLinesMaxRate = 90f;

        float currentRoll;

        public Transform Target
        {
            get => target;
            set => target = value;
        }

        void Awake()
        {
            ResolveReferences();
        }

        void OnValidate()
        {
            if (followCamera == null)
            {
                followCamera = GetComponentInChildren<Camera>();
            }
        }

        void LateUpdate()
        {
            if (target == null)
            {
                return;
            }

            ResolveReferences();

            Quaternion yawRotation = followTargetRotation
                ? Quaternion.Euler(0f, target.eulerAngles.y, 0f)
                : Quaternion.identity;

            float speed01 = GetSpeedRatio();
            Vector3 speedOffset = offset;

            if (useSpeedFeel)
            {
                speedOffset.z -= highSpeedExtraDistance * speed01;
                speedOffset.y -= highSpeedLowering * speed01;
            }

            Vector3 desiredPosition = target.position + yawRotation * speedOffset;
            transform.position = Vector3.Lerp(transform.position, desiredPosition, followSmoothing * Time.deltaTime);

            Vector3 lookTarget = target.position + Vector3.up * lookHeight;
            Quaternion desiredRotation = Quaternion.LookRotation(lookTarget - transform.position, Vector3.up);

            float targetRoll = useSteeringTilt && controls != null
                ? -controls.SteeringInput * maxRollAngle * speed01
                : 0f;
            currentRoll = Mathf.Lerp(currentRoll, targetRoll, rollSmoothing * Time.deltaTime);

            desiredRotation *= Quaternion.Euler(0f, 0f, currentRoll);
            transform.rotation = Quaternion.Slerp(transform.rotation, desiredRotation, rotationSmoothing * Time.deltaTime);

            UpdateFov(speed01);
            UpdateSpeedLines();
        }

        void ResolveReferences()
        {
            if (target == null)
            {
                return;
            }

            if (vehicle == null)
            {
                vehicle = target.GetComponent<BicycleVehicle>();
            }

            if (controls == null)
            {
                controls = target.GetComponent<BikeControlsExample>();
            }

            if (followCamera == null)
            {
                followCamera = GetComponentInChildren<Camera>();
            }
        }

        float GetSpeedRatio()
        {
            if (!useSpeedFeel || vehicle == null || speedFeelAtKmh <= 0f)
            {
                return 0f;
            }

            float speedKmh = vehicle.currentSpeed * 3.6f;
            return Mathf.Clamp01(speedKmh / speedFeelAtKmh);
        }

        void UpdateFov(float speed01)
        {
            if (!useSpeedFeel || followCamera == null)
            {
                return;
            }

            float targetFov = Mathf.Lerp(lowSpeedFov, highSpeedFov, speed01);
            followCamera.fieldOfView = Mathf.Lerp(followCamera.fieldOfView, targetFov, fovSmoothing * Time.deltaTime);
        }

        void UpdateSpeedLines()
        {
            if (speedLines == null || vehicle == null)
            {
                return;
            }

            float speedKmh = vehicle.currentSpeed * 3.6f;
            float lineRatio = Mathf.InverseLerp(speedLinesStartKmh, speedFeelAtKmh, speedKmh);
            ParticleSystem.EmissionModule emission = speedLines.emission;
            emission.rateOverTime = speedLinesMaxRate * lineRatio;

            if (lineRatio > 0.01f && !speedLines.isPlaying)
            {
                speedLines.Play();
            }
            else if (lineRatio <= 0.01f && speedLines.isPlaying)
            {
                speedLines.Stop();
            }
        }
    }
}
