try:
    from routes.auth import router
    print("Success! Router imported successfully")
    print(f"Router type: {type(router)}")
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
