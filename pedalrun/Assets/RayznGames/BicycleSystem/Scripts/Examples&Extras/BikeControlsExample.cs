using rayzngames;
using UnityEngine;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace rayzngames
{        
    public class BikeControlsExample : MonoBehaviour
    {
        BicycleVehicle bicycle;
        Rigidbody rb;
        public bool controllingBike = true;
        [SerializeField] bool usePedalTapInput = true;
        [SerializeField] float pedalGain = 0.12f;
        [SerializeField] float fastPedalBonus = 0.16f;
        [SerializeField] float fastPedalInterval = 0.16f;
        [SerializeField] float slowPedalInterval = 0.45f;
        [SerializeField] float pedalDecayPerSecond = 0.4f;
        [SerializeField] float wrongPedalPenalty = 0.04f;
        [SerializeField] float maxPedalInput = 0.65f;
        [SerializeField] float pedalAssistForce = 2.5f;
        [SerializeField] float maxAssistSpeed = 8f;
        [SerializeField] float maxSpeedKmh = 35f;
        [SerializeField] bool usePointerSteering = true;
        [SerializeField] float pointerSteeringSensitivity = 4f;
        [SerializeField] float pointerSteeringReturnSpeed = 6f;
        [SerializeField] float pointerDeltaDeadZone = 0.002f;
        [SerializeField] bool showInputDebug = true;
        [SerializeField] bool showSpeedHud = true;

        KeyCode lastPedalKey = KeyCode.None;
        float pedalPower;
        float lastPedalTime = -1f;
        float pointerSteering;
        float lastPointerX;
        bool hasPointerPosition;
        bool debugW;
        bool debugS;
        bool debugA;
        bool debugD;

        public float SteeringInput => bicycle != null ? bicycle.horizontalInput : pointerSteering;
        public float PedalPower => pedalPower;

        // Start is called once before the first execution of Update after the MonoBehaviour is created
        void Awake()
        {
            bicycle = GetComponent<BicycleVehicle>();
            rb = GetComponent<Rigidbody>();
            controllingBike = true;
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
        }
        // Update is called once per frame
        void Update()
        {
            controllingBike = true;
            bicycle.verticalInput = usePedalTapInput ? ReadPedalTapInput() : ReadVerticalAxis();
            bicycle.horizontalInput = usePointerSteering ? ReadPointerSteering() : ReadHorizontalInput();
            BrakingInput();

            //Extending functionality 
            bicycle.InControl(controllingBike);

            if (controllingBike)
            {
                //Constrains the Z rotation of the bike, when onground, and releases it when airborne.
                bicycle.ConstrainRotation(bicycle.OnGround());
            }
            else
            {
                bicycle.ConstrainRotation(false);
            }

            /*
            //Detach controls
            if (bicycle.OnGround() == false) { controllingBike = false; }

            //Landing Controls (Land Pressing E)
            if (Input.GetKey(KeyCode.E)) { controllingBike = true; }
            bicycle.InControl(controllingBike);   
            */
        }

        void FixedUpdate()
        {
            LimitTopSpeed();

            if (!usePedalTapInput || !controllingBike || pedalPower <= 0.01f || rb == null || bicycle.currentSpeed >= maxAssistSpeed)
            {
                return;
            }

            rb.AddForce(transform.forward * (pedalPower * pedalAssistForce), ForceMode.Acceleration);
        }

        void LimitTopSpeed()
        {
            if (rb == null || maxSpeedKmh <= 0f)
            {
                return;
            }

            float maxSpeedMs = maxSpeedKmh / 3.6f;
            Vector3 velocity = rb.linearVelocity;
            Vector3 horizontalVelocity = new Vector3(velocity.x, 0f, velocity.z);

            if (horizontalVelocity.magnitude <= maxSpeedMs)
            {
                return;
            }

            Vector3 limitedHorizontalVelocity = horizontalVelocity.normalized * maxSpeedMs;
            rb.linearVelocity = new Vector3(limitedHorizontalVelocity.x, velocity.y, limitedHorizontalVelocity.z);
        }
        void BrakingInput()
        {
            if (WasPressedThisFrame(KeyCode.Space))
            {
                bicycle.braking = true;
            }
            if (WasReleasedThisFrame(KeyCode.Space))
            {
                bicycle.braking = false;
            }

        }

        float ReadVerticalAxis()
        {
#if ENABLE_LEGACY_INPUT_MANAGER
            return Input.GetAxis("Vertical");
#else
            float vertical = 0f;

            if (IsPressed(KeyCode.W) || IsPressed(KeyCode.UpArrow))
            {
                vertical += 1f;
            }

            if (IsPressed(KeyCode.S) || IsPressed(KeyCode.DownArrow))
            {
                vertical -= 1f;
            }

            return vertical;
#endif
        }

        float ReadHorizontalInput()
        {
            float horizontal = 0f;

            if (IsPressed(KeyCode.A) || IsPressed(KeyCode.LeftArrow))
            {
                horizontal -= 1f;
            }

            if (IsPressed(KeyCode.D) || IsPressed(KeyCode.RightArrow))
            {
                horizontal += 1f;
            }

            return horizontal;
        }

        float ReadPedalTapInput()
        {
            bool pressedW = WasPressedThisFrame(KeyCode.W);
            bool pressedS = WasPressedThisFrame(KeyCode.S);

            if (pressedW || pressedS)
            {
                KeyCode pressedKey = pressedW ? KeyCode.W : KeyCode.S;

                if (pressedKey != lastPedalKey)
                {
                    pedalPower = Mathf.Clamp01(pedalPower + CalculatePedalGain());
                    lastPedalKey = pressedKey;
                    lastPedalTime = Time.time;
                }
                else
                {
                    pedalPower = Mathf.Clamp01(pedalPower - wrongPedalPenalty);
                }
            }

            debugW = IsPressed(KeyCode.W);
            debugS = IsPressed(KeyCode.S);
            debugA = IsPressed(KeyCode.A);
            debugD = IsPressed(KeyCode.D);

            if (debugW && debugS)
            {
                pedalPower = Mathf.Clamp01(pedalPower + pedalGain * Time.deltaTime);
            }

            pedalPower = Mathf.Clamp01(pedalPower - pedalDecayPerSecond * Time.deltaTime);
            return Mathf.Min(pedalPower, maxPedalInput);
        }

        float CalculatePedalGain()
        {
            if (lastPedalTime < 0f)
            {
                return pedalGain;
            }

            float interval = Time.time - lastPedalTime;
            float speedRatio = Mathf.InverseLerp(slowPedalInterval, fastPedalInterval, interval);
            return pedalGain + fastPedalBonus * speedRatio;
        }

        float ReadPointerSteering()
        {
            bool pointerDown = PointerDown();

            if (PointerPressedThisFrame())
            {
                lastPointerX = PointerX();
                hasPointerPosition = true;
            }

            if (pointerDown)
            {
                float currentPointerX = PointerX();
                float deltaRatio = PointerDeltaX(currentPointerX) / Mathf.Max(1f, Screen.width);

                if (Mathf.Abs(deltaRatio) > pointerDeltaDeadZone)
                {
                    pointerSteering = Mathf.Clamp(pointerSteering + deltaRatio * pointerSteeringSensitivity, -1f, 1f);
                }

                lastPointerX = currentPointerX;
                hasPointerPosition = true;
            }
            else
            {
                hasPointerPosition = false;
                pointerSteering = Mathf.MoveTowards(pointerSteering, 0f, pointerSteeringReturnSpeed * Time.deltaTime);
            }

            return pointerSteering;
        }

        float PointerDeltaX(float currentPointerX)
        {
            if (hasPointerPosition)
            {
                float positionDelta = currentPointerX - lastPointerX;
                if (Mathf.Abs(positionDelta) > 0.001f)
                {
                    return positionDelta;
                }
            }

#if ENABLE_LEGACY_INPUT_MANAGER
            float legacyDelta = Input.GetAxisRaw("Mouse X") * 18f;
            if (Mathf.Abs(legacyDelta) > 0f)
            {
                return legacyDelta;
            }
#endif

#if ENABLE_INPUT_SYSTEM
            if (Mouse.current != null)
            {
                return Mouse.current.delta.ReadValue().x;
            }

            if (Touchscreen.current != null)
            {
                return Touchscreen.current.primaryTouch.delta.ReadValue().x;
            }
#endif

            return 0f;
        }

        bool IsPressed(KeyCode key)
        {
#if ENABLE_LEGACY_INPUT_MANAGER
            bool legacyPressed = Input.GetKey(key);
#else
            bool legacyPressed = false;
#endif

#if ENABLE_INPUT_SYSTEM
            Keyboard keyboard = Keyboard.current;
            if (keyboard == null)
            {
                return legacyPressed;
            }

            return legacyPressed || key switch
            {
                KeyCode.W => keyboard.wKey.isPressed,
                KeyCode.S => keyboard.sKey.isPressed,
                KeyCode.A => keyboard.aKey.isPressed,
                KeyCode.D => keyboard.dKey.isPressed,
                KeyCode.LeftArrow => keyboard.leftArrowKey.isPressed,
                KeyCode.RightArrow => keyboard.rightArrowKey.isPressed,
                KeyCode.Space => keyboard.spaceKey.isPressed,
                _ => false
            };
#else
            return legacyPressed;
#endif
        }

        bool PointerDown()
        {
#if ENABLE_LEGACY_INPUT_MANAGER
            if (Input.GetMouseButton(0))
            {
                return true;
            }
#endif

#if ENABLE_INPUT_SYSTEM
            if (Mouse.current != null && Mouse.current.leftButton.isPressed)
            {
                return true;
            }

            if (Touchscreen.current != null && Touchscreen.current.primaryTouch.press.isPressed)
            {
                return true;
            }
#endif

            return false;
        }

        bool PointerPressedThisFrame()
        {
#if ENABLE_LEGACY_INPUT_MANAGER
            if (Input.GetMouseButtonDown(0))
            {
                return true;
            }
#endif

#if ENABLE_INPUT_SYSTEM
            if (Mouse.current != null && Mouse.current.leftButton.wasPressedThisFrame)
            {
                return true;
            }

            if (Touchscreen.current != null && Touchscreen.current.primaryTouch.press.wasPressedThisFrame)
            {
                return true;
            }
#endif

            return false;
        }

        float PointerX()
        {
#if ENABLE_INPUT_SYSTEM
            if (Touchscreen.current != null && Touchscreen.current.primaryTouch.press.isPressed)
            {
                return Touchscreen.current.primaryTouch.position.ReadValue().x;
            }

            if (Mouse.current != null)
            {
                return Mouse.current.position.ReadValue().x;
            }
#endif

#if ENABLE_LEGACY_INPUT_MANAGER
            return Input.mousePosition.x;
#else
            return 0f;
#endif
        }

        bool WasPressedThisFrame(KeyCode key)
        {
#if ENABLE_LEGACY_INPUT_MANAGER
            bool legacyPressed = Input.GetKeyDown(key);
#else
            bool legacyPressed = false;
#endif

#if ENABLE_INPUT_SYSTEM
            Keyboard keyboard = Keyboard.current;
            if (keyboard == null)
            {
                return legacyPressed;
            }

            return legacyPressed || key switch
            {
                KeyCode.W => keyboard.wKey.wasPressedThisFrame,
                KeyCode.S => keyboard.sKey.wasPressedThisFrame,
                KeyCode.A => keyboard.aKey.wasPressedThisFrame,
                KeyCode.D => keyboard.dKey.wasPressedThisFrame,
                KeyCode.LeftArrow => keyboard.leftArrowKey.wasPressedThisFrame,
                KeyCode.RightArrow => keyboard.rightArrowKey.wasPressedThisFrame,
                KeyCode.Space => keyboard.spaceKey.wasPressedThisFrame,
                _ => false
            };
#else
            return legacyPressed;
#endif
        }

        bool WasReleasedThisFrame(KeyCode key)
        {
#if ENABLE_LEGACY_INPUT_MANAGER
            bool legacyReleased = Input.GetKeyUp(key);
#else
            bool legacyReleased = false;
#endif

#if ENABLE_INPUT_SYSTEM
            Keyboard keyboard = Keyboard.current;
            if (keyboard == null)
            {
                return legacyReleased;
            }

            return legacyReleased || key switch
            {
                KeyCode.W => keyboard.wKey.wasReleasedThisFrame,
                KeyCode.S => keyboard.sKey.wasReleasedThisFrame,
                KeyCode.A => keyboard.aKey.wasReleasedThisFrame,
                KeyCode.D => keyboard.dKey.wasReleasedThisFrame,
                KeyCode.LeftArrow => keyboard.leftArrowKey.wasReleasedThisFrame,
                KeyCode.RightArrow => keyboard.rightArrowKey.wasReleasedThisFrame,
                KeyCode.Space => keyboard.spaceKey.wasReleasedThisFrame,
                _ => false
            };
#else
            return legacyReleased;
#endif
        }

        void OnGUI()
        {
            if (showSpeedHud)
            {
                DrawSpeedHud();
            }

            if (!showInputDebug)
            {
                return;
            }

            GUI.Label(new Rect(16, 16, 420, 120),
                $"Bike input debug\nW:{debugW} S:{debugS} A:{debugA} D:{debugD}\nPedalPower:{pedalPower:0.00} Vertical:{bicycle.verticalInput:0.00} Horizontal:{bicycle.horizontalInput:0.00}\nPointerSteering:{pointerSteering:0.00} Speed:{bicycle.currentSpeed:0.00}");
        }

        void DrawSpeedHud()
        {
            float speedKmh = bicycle.currentSpeed * 3.6f;
            const float width = 180f;
            const float height = 54f;
            Rect rect = new Rect(Screen.width - width - 18f, 18f, width, height);

            GUI.Box(rect, GUIContent.none);

            GUIStyle speedStyle = new GUIStyle(GUI.skin.label)
            {
                alignment = TextAnchor.MiddleRight,
                fontSize = 28,
                fontStyle = FontStyle.Bold
            };

            GUIStyle unitStyle = new GUIStyle(GUI.skin.label)
            {
                alignment = TextAnchor.LowerRight,
                fontSize = 12
            };

            GUI.Label(new Rect(rect.x + 8f, rect.y + 2f, rect.width - 16f, 34f), $"{speedKmh:0}", speedStyle);
            GUI.Label(new Rect(rect.x + 8f, rect.y + 32f, rect.width - 16f, 18f), "km/h", unitStyle);
        }
    }
}
