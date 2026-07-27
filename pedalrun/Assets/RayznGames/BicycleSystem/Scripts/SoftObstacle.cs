using UnityEngine;

public sealed class SoftObstacle : MonoBehaviour
{
    [Header("Impulse Clamp")]
    public float maxUpwardVelocity = 1.8f;
    public float maxHorizontalVelocity = 9f;
    public float dampingMultiplier = 0.45f;

    [Header("Feedback")]
    public bool allowSmallHop = true;
    public float smallHopVelocity = 0.8f;

    private void OnCollisionEnter(Collision collision)
    {
        Rigidbody body = collision.rigidbody;
        if (body == null)
        {
            body = collision.collider.attachedRigidbody;
        }

        if (body == null)
        {
            return;
        }

        Vector3 velocity = body.linearVelocity;
        Vector3 horizontal = new Vector3(velocity.x, 0f, velocity.z);

        if (horizontal.magnitude > maxHorizontalVelocity)
        {
            horizontal = horizontal.normalized * maxHorizontalVelocity;
        }
        else
        {
            horizontal *= dampingMultiplier;
        }

        float yVelocity = Mathf.Clamp(velocity.y, -maxUpwardVelocity, maxUpwardVelocity);
        if (allowSmallHop && yVelocity < smallHopVelocity)
        {
            yVelocity = smallHopVelocity;
        }

        body.linearVelocity = new Vector3(horizontal.x, yVelocity, horizontal.z);
        body.angularVelocity *= dampingMultiplier;
    }
}
